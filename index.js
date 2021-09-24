#!/usr/bin/env node

const readline = require('readline')
const util = require('util')

const {
  CloudFormationClient,
  DescribeStacksCommand
} = require('@aws-sdk/client-cloudformation')
const AWS = require('@aws-sdk/client-cloudformation')
const chalk = require('chalk')
const randomColor = require('random-color')

const cfnEvents = require('./lib/cfn-events')
const helpers = require('./lib/helpers')
const output = require('./lib/output')

const IN_PROGRESS_STATUSES = [
  'CREATE_IN_PROGRESS',
  'DELETE_IN_PROGRESS',
  'REVIEW_IN_PROGRESS',
  'ROLLBACK_IN_PROGRESS',
  'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS',
  'UPDATE_IN_PROGRESS',
  'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
  'UPDATE_ROLLBACK_IN_PROGRESS'
]

const monitoredStackArns = new Set()
let monitoredStacks = 0
let inputFinished = false

function maybeExit () {
  if (monitoredStacks === 0 && inputFinished) {
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
async function maybeStartToMonitorStack (input) {
  const info = helpers.getStackInfoFromInput(input)
  if (!info) {
    return
  }

  if (monitoredStackArns.has(info.arn)) {
    // Skip this stack. It's being monitored already.
    return
  }

  monitoredStackArns.add(info.arn)
  monitoredStacks += 1

  const color = randomColor().hexString()
  const cfn = new CloudFormationClient({ region: info.region })
  const cmd = new DescribeStacksCommand({ StackName: info.arn })
  const res = await cfn.send(cmd).catch((err) => {
    if (err.message.endsWith('does not exist')) {
      output.write(chalk.hex(color)(info.name), 'Stack does not exist')
      stackMonitoringFinished()
      return
    }

    throw err
  })
  if (!res) {
    return
  }
  const stack = res.Stacks[0]
  const status = stack.StackStatus
  if (!status.endsWith('_IN_PROGRESS')) {
    output.write(chalk.hex(color)(info.name), 'No operations ongoing')
    stackMonitoringFinished()
    return
  }

  const nestedStacks = []
  for await (const e of cfnEvents.streamStackEvents(
    stack.StackName,
    stack.StackId,
    info.region
  )) {
    const reason = e.ResourceStatusReason
      ? util.format(' (Reason: %s)', e.ResourceStatusReason)
      : ''
    output.write(
      util.format(
        '%s %s %s %s %s %s',
        chalk.hex(color)(info.name),
        e.Timestamp.toISOString(),
        e.ResourceStatus,
        e.ResourceType,
        e.LogicalResourceId,
        reason
      )
    )

    if (
      e.ResourceType === 'AWS::CloudFormation::Stack' &&
      e.StackId !== e.PhysicalResourceId
    ) {
      // This event was about nested stack. Start to monitor that as well
      nestedStacks.push(maybeStartToMonitorStack(e.PhysicalResourceId))
    }
  }

  await Promise.all(nestedStacks)
  stackMonitoringFinished()
}

async function startToMonitorInProgressStacks () {
  const cfn = new AWS.CloudFormation({})
  const res = await cfn.listStacks({ StackStatusFilter: IN_PROGRESS_STATUSES })
  const stacks = res.StackSummaries
  if (stacks.length === 0) {
    output.write(
      `${chalk.green(
        'INFO'
      )}: No stacks are being created / deleted / updated. Exiting`
    )
    process.exit(0)
  }

  output.write(
    `${chalk.green('INFO')}: ${stacks.length} stack${stacks.length === 1 ? ' is' : 's are'
    } being changed.`
  )
  stacks.forEach((stack) => {
    maybeStartToMonitorStack(stack.StackId)
  })
}

async function startToMonitorDeletingStacks () {
  const cfn = new AWS.CloudFormation({})
  const res = await cfn.listStacks({
    StackStatusFilter: ['DELETE_IN_PROGRESS']
  })

  const stacks = res.StackSummaries
  if (stacks.length === 0) {
    output.write(`${chalk.green('INFO')}: No stacks are being deleted. Exiting`)
    process.exit(0)
  }

  output.write(`${chalk.green('INFO')}: ${stacks.length} stack${stacks.length === 1 ? ' is' : 's are'} being deleted.`)
  stacks.forEach(stack => {
    maybeStartToMonitorStack(stack.StackId)
  })
}

function run () {
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

    let isDeploy = false

    rl.on('line', line => {
      // echo to stdout
      output.write(line)
      maybeStartToMonitorStack(line)

      if (!isDeploy && line.match(/Waiting for stack create\/update to complete/)) {
        output.write(chalk.green('INFO') + ': The command piped to cfn-monitor ' +
          'seems to be aws cloudformation deploy. The command does not echo the ' +
          'stack name it is operating on. Starting to monitor all stacks that are ' +
          'being modified.')
        isDeploy = true
        startToMonitorInProgressStacks()
      }
    })

    rl.on('close', () => {
      if (!monitoredStacks && !isDeploy) {
        output.write(chalk.green('INFO') + ': The command piped to cfn-monitor ' +
          'did not produce any output. Assuming it was a delete-stack operation. ' +
          'Starting to monitor stacks that are being deleted.')
        startToMonitorDeletingStacks()
      }

      inputFinished = true
    })
  } else {
    if (!monitoredStacks) {
      output.write(chalk.green('INFO') + ': No input nor stacks from the command ' +
        'line. Starting to monitor all stacks that are being modified.')
      startToMonitorInProgressStacks()
    }
  }
}

if (require.main === module) {
  run()
}

module.exports = {
  startToMonitorInProgressStacks,
  startToMonitorDeletingStacks,
  maybeStartToMonitorStack
}
