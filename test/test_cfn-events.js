/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect
const { mockClient } = require('aws-sdk-client-mock')

const { CloudFormationClient } = require('@aws-sdk/client-cloudformation')

const cfnEvents = require('../lib/cfn-events')
const utils = require('./utils')
const mockCfnEvents = require('./mock-cfn-events')

describe('cfn-events', function () {
  const cfMock = mockClient(CloudFormationClient)
  beforeEach(() => {
    cfMock.reset()
  })

  after(() => {
    cfMock.restore()
  })

  it('should poll stack events correctly', async function () {
    cfMock
      .onAnyCommand({
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
      .onAnyCommand({
        StackName: 'test-stack-id'
      })
      .callsFake(mockCfnEvents.mockDescribeStackEvents([
        [
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack',
            ResourceStatus: 'CREATE_COMPLETE',
            StackId: 'test-stack-id',
            StackName: 'test-stack',
            Timestamp: new Date(),
            EventId: '0002'
          },
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack',
            ResourceStatus: 'CREATE_COMPLETE',
            StackId: 'test-stack-id',
            StackName: 'test-stack',
            Timestamp: new Date(),
            EventId: '0001'
          }
        ]
      ]))
    const events = await utils.asyncGeneratorToArray(
      cfnEvents.streamStackEvents(
        'test-stack',
        'test-stack-id',
        'eu-north-1'
      )
    )
    expect(events.map((e) => e.EventId)).to.deep.equal([
      '0001',
      '0002'
    ])
  })
})
