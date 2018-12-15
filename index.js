#!/usr/bin/env node

const readline = require('readline')
const util = require('util')

const AWS = require('aws-sdk')
const EventStream = require('cfn-stack-event-stream')
const chalk = require('chalk')
const randomColor = require('random-color')

const helpers = require('./lib/helpers')

let monitoredStacks = 0

function maybeExit () {
  if (monitoredStacks === 0) {
    process.exit(0)
  }
}

function stackMonitoringFinished () {
  monitoredStacks -= 1
  maybeExit()
}

/**
 * Checks the given input for CloudFormation stack ARN and
 * starts to monitor a stack if one is found from the given
 * input.
 *
 * @param {String} input the input to parse
 */
function maybeStartToMonitorStack (input) {
  const info = helpers.getStackInfoFromInput(input)
  if (!info) {
    return
  }

  monitoredStacks += 1

  const color = randomColor().hexString()
  const cfn = new AWS.CloudFormation({ region: info.region })
  cfn.describeStacks({ StackName: info.arn }, function (err, res) {
    if (err) {
      if (err.message.endsWith('does not exist')) {
        console.log(chalk.hex(color)(info.name), 'Stack does not exist')
        stackMonitoringFinished()
        return
      } else {
        throw err
      }
    }

    const stack = res.Stacks[0]
    const status = stack.StackStatus
    if (!status.endsWith('_IN_PROGRESS')) {
      console.log(chalk.hex(color)(info.name), 'No operations ongoing')
      stackMonitoringFinished()
      return
    }

    EventStream(cfn, info.name, { pollInterval: 1000 })
      .on('data', function (e) {
        const reason = e.ResourceStatusReason ? util.format(' (Reason: %s)', e.ResourceStatusReason) : ''
        console.log(util.format('%s %s %s %s %s %s',
          chalk.hex(color)(info.name),
          e.Timestamp.toISOString(), e.ResourceStatus, e.ResourceType,
          e.LogicalResourceId, reason))
      })
      .on('end', function () {
        stackMonitoringFinished()
      })
  })
}

function startToMonitorDeletingStacks () {
  const region = AWS.config.region
  if (!region) {
    // A region hasn't been configured globally; can't do anything
    // useful if we didn't get any input
    console.error(chalk.red('ERROR') + ': No region configured. Please ' +
      'configure a region with the AWS_REGION variable.')
    process.exit(0)
  }

  const cfn = new AWS.CloudFormation({ region })
  cfn.listStacks({ StackStatusFilter: ['DELETE_IN_PROGRESS'] }, function (err, res) {
    if (err) {
      throw err
    }

    const stacks = res.StackSummaries
    if (stacks.length === 0) {
      console.log(`${chalk.green('INFO')}: No stacks are being deleted. Exiting`)
      process.exit(0)
    }

    console.log(`${chalk.green('INFO')}: ${stacks.length} stack${stacks.length === 1 ? ' is' : 's are'} being deleted.`)
    stacks.forEach(stack => {
      maybeStartToMonitorStack(stack.StackId)
    })
  })
}

// See if we have a stack ARN(s) given as command line argument(s)
if (process.argv.length > 2) {
  process.argv.slice(2).forEach(arg => {
    maybeStartToMonitorStack(arg)
  })
}

// Also check if we have been piped some input and detect stack
// IDs from there
if (!process.stdin.isTTY) {
  const rl = readline.createInterface({
    input: process.stdin
  })

  rl.on('line', line => {
    // echo to stdout
    console.log(line)
    maybeStartToMonitorStack(line)
  })

  rl.on('close', () => {
    if (!monitoredStacks) {
      console.log(chalk.green('INFO') + ': The command piped to cfn-monitor ' +
        'did not produce any output. Assuming it was a delete-stack operation. ' +
        'Starting to monitor stacks that are being deleted.')
      startToMonitorDeletingStacks()
    }
  })
}
