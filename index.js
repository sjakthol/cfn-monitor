#!/usr/bin/env node

const readline = require('readline')
const util = require('util')

const AWS = require('aws-sdk')
const EventStream = require('cfn-stack-event-stream')
const chalk = require('chalk')
const randomColor = require('random-color')

const helpers = require('./lib/helpers')

const rl = readline.createInterface({
  input: process.stdin
})

rl.on('line', line => {
  // echo to stdout
  console.log(line)

  const info = helpers.getStackInfoFromInput(line)
  if (!info) {
    return
  }

  const color = randomColor().hexString()
  const cfn = new AWS.CloudFormation({ region: info.region })
  EventStream(cfn, info.name)
    .on('data', function (e) {
      const reason = e.ResourceStatusReason ? util.format(' (Reason: %s)', e.ResourceStatusReason) : ''
      console.log(util.format('%s %s %s %s %s %s',
        chalk.hex(color)(info.name),
        e.Timestamp.toISOString(), e.ResourceStatus, e.ResourceType,
        e.LogicalResourceId, reason))
    })
})
