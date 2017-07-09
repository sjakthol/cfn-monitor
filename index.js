#!/usr/bin/env node

const AWS = require('aws-sdk')
const EventStream = require('cfn-stack-event-stream')
const stdin = require('stdin')
const util = require('util')

const helpers = require('./lib/helpers')

stdin(function (data) {
  const info = helpers.getStackInfoFromInput(data)
  if (!info) {
    process.exit(1)
  }

  const cfn = new AWS.CloudFormation({ region: info.region })
  EventStream(cfn, info.name)
    .on('data', function (e) {
      const reason = e.ResourceStatusReason ? util.format(' (Reason: %s)', e.ResourceStatusReason) : ''
      console.log(util.format('%s %s %s %s %s',
        e.Timestamp.toISOString(), e.ResourceStatus, e.ResourceType,
        e.LogicalResourceId, reason))
    })
})
