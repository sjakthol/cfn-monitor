/* eslint-env mocha */
import { expect } from 'chai'
import { mockClient } from 'aws-sdk-client-mock'

import {
  CloudFormationClient,
  DescribeStackEventsCommand
} from '@aws-sdk/client-cloudformation'

import cfnEvents from '../lib/cfn-events.js'
import utils from './utils.js'
import mockCfnEvents from './mock-cfn-events.js'

describe('cfn-events', function () {
  let cfMock
  before(() => {
    cfMock = mockClient(CloudFormationClient)
  })

  afterEach(() => {
    cfMock.reset()
  })

  after(() => {
    cfMock.restore()
  })

  it('should poll stack events correctly', async function () {
    cfMock
      .on(DescribeStackEventsCommand, {
        StackName: 'test-stack-id'
      })
      .callsFake(mockCfnEvents.mockDescribeStackEvents(mockCfnEvents.SampleStackEventsPerPollingRound))

    const events = await utils.asyncGeneratorToArray(
      cfnEvents.streamStackEvents(
        'test-stack',
        'test-stack-id',
        'eu-north-1',
        10
      )
    )
    expect(events.map((e) => e.EventId)).to.deep.equal([
      '0001',
      '0002',
      '0003',
      '0004',
      '0005',
      '0006'
    ])
  })

  it('should poll stack events correctly with default polling interval', async function () {
    cfMock
      .on(DescribeStackEventsCommand, {
        StackName: 'test-stack-id'
      })
      .callsFake(mockCfnEvents.mockDescribeStackEvents(mockCfnEvents.SampleStackEventsPerPollingRoundSimple))
    const events = await utils.asyncGeneratorToArray(
      cfnEvents.streamStackEvents(
        'test-stack',
        'test-stack-id',
        'eu-north-1'
      )
    )
    expect(events.map((e) => e.EventId)).to.deep.equal([
      '0002',
      '0003',
      '0004',
      '0005'
    ])
  })

  it('should handle cleanup states correctly', async function () {
    cfMock
      .on(DescribeStackEventsCommand, {
        StackName: 'test-stack-id'
      })
      .callsFake(mockCfnEvents.mockDescribeStackEvents(mockCfnEvents.SampleStackEventsPerPollingRoundWithCleanup))
    const events = await utils.asyncGeneratorToArray(
      cfnEvents.streamStackEvents(
        'test-stack',
        'test-stack-id',
        'eu-north-1'
      )
    )
    expect(events.map((e) => e.EventId)).to.deep.equal([
      '0002',
      '0003',
      '0004',
      '0005',
      '0006'
    ])
  })

  it('should handle FAILED end state correctly', async function () {
    cfMock
      .on(DescribeStackEventsCommand, {
        StackName: 'test-stack-id'
      })
      .callsFake(mockCfnEvents.mockDescribeStackEvents(mockCfnEvents.SampleStackEventsDeleteFailedState))
    const events = await utils.asyncGeneratorToArray(
      cfnEvents.streamStackEvents(
        'test-stack',
        'test-stack-id',
        'eu-north-1'
      )
    )
    expect(events.map((e) => e.EventId)).to.deep.equal([
      '0002',
      '0003',
      '0004',
      '0005'
    ])
  })
})
