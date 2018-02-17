#!/usr/bin/env node

const readline = require('readline')
const util = require('util')

const AWS = require('aws-sdk')
const EventStream = require('cfn-stack-event-stream')
const chalk = require('chalk')
const randomColor = require('random-color')

const helpers = require('./lib/helpers')

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

  const color = randomColor().hexString()
  const cfn = new AWS.CloudFormation({ region: info.region })
  cfn.describeStacks({ StackName: info.arn }, function (err, res) {
    if (err) {
      if (err.message.endsWith('does not exist')) {
        console.log(chalk.hex(color)(info.name), 'Stack does not exist')
        return
      } else {
        throw err
      }
    }

    const stack = res.Stacks[0]
    const status = stack.StackStatus
    if (!status.endsWith('_IN_PROGRESS')) {
      console.log(chalk.hex(color)(info.name), 'No operations ongoing')
      return
    }

    EventStream(cfn, info.name)
    .on('data', function (e) {
      const reason = e.ResourceStatusReason ? util.format(' (Reason: %s)', e.ResourceStatusReason) : ''
      console.log(util.format('%s %s %s %s %s %s',
        chalk.hex(color)(info.name),
        e.Timestamp.toISOString(), e.ResourceStatus, e.ResourceType,
        e.LogicalResourceId, reason))
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
}
