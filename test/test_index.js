/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.use(require('dirty-chai'))

const { mockClient } = require('aws-sdk-client-mock')
const { CloudFormationClient, DescribeStacksCommand, DescribeStackEventsCommand } = require('@aws-sdk/client-cloudformation')

const index = require('../index')
const output = require('../lib/output')
const mockCfnEvents = require('./mock-cfn-events')

const SAMPLE_STACK_ARN = 'arn:aws:cloudformation:eu-west-1:0123456789012:stack/test-stack/1'

describe('index', function () {
  let cfMock
  let logStub

  const getLogLines = () => logStub.getCalls().map(call => call.args.join(' '))

  before(() => {
    cfMock = mockClient(CloudFormationClient)
    logStub = sinon.stub(output, 'write')
  })

  beforeEach(() => {
    logStub.returns(null)
  })

  afterEach(() => {
    cfMock.reset()
    logStub.reset()
  })

  after(() => {
    cfMock.restore()
  })

  describe('maybeStartToMonitorStack', function () {
    it('should skip input that does not contain a stack ARN', async function () {
      await index.maybeStartToMonitorStack('not a stack')
    })

    it('should skip deleted stacks', async function () {
      cfMock
        .on(DescribeStacksCommand, {
          StackName: SAMPLE_STACK_ARN + 1
        })
        .rejects({
          message: 'test-stack does not exist'
        })

      await index.maybeStartToMonitorStack(SAMPLE_STACK_ARN + 1)
      expect(logStub).to.have.calledOnce()
      expect(logStub.getCall(0).args.join(' ')).to.match(/test-stack.+Stack does not exist/)
    })

    it('should report errors', async function () {
      cfMock
        .on(DescribeStacksCommand, {
          StackName: SAMPLE_STACK_ARN + 2
        })
        .rejects({
          message: 'Something went wrong'
        })

      await index.maybeStartToMonitorStack(SAMPLE_STACK_ARN + 2)
        .then(() => new Error('Unexpected success'), () => { })
    })

    it('should monitor stack events correctly', async function () {
      cfMock
        .on(DescribeStacksCommand, {
          StackName: SAMPLE_STACK_ARN + 3
        })
        .resolves({
          Stacks: [{
            StackStatus: 'CREATE_IN_PROGRESS',
            StackName: 'test-stack',
            StackId: 'test-stack/1',
            CreationTime: new Date()
          }]
        })
      cfMock
        .on(DescribeStackEventsCommand, {
          StackName: 'test-stack/1'
        })
        .callsFake(mockCfnEvents.mockDescribeStackEvents(mockCfnEvents.SampleStackEventsPerPollingRoundSimple))

      await index.maybeStartToMonitorStack(SAMPLE_STACK_ARN + 3)

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(4)
      expect(logLines[0]).to.match(/UPDATE_IN_PROGRESS AWS::CloudFormation::Stack test-stack/)
      expect(logLines[1]).to.match(/UPDATE_IN_PROGRESS AWS::SNS::Topic test-topic/)
      expect(logLines[2]).to.match(/UPDATE_COMPLETE AWS::SNS::Topic test-topic/)
      expect(logLines[3]).to.match(/UPDATE_COMPLETE AWS::CloudFormation::Stack test-stack/)
    })

    it('should skip stacks without ongoing operations', async function () {
      cfMock
        .on(DescribeStacksCommand, {
          StackName: SAMPLE_STACK_ARN + 4
        })
        .resolves({
          Stacks: [{
            StackStatus: 'CREATE_COMPLETE',
            StackName: 'test-stack',
            StackId: 'test-stack/1',
            CreationTime: new Date()
          }]
        })

      await index.maybeStartToMonitorStack(SAMPLE_STACK_ARN + 4)

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(1)
      expect(logLines[0]).to.match(/No operations ongoing/)
    })
    it('should skip stacks that are already monitored', async function () {
      cfMock
        .on(DescribeStacksCommand, {
          StackName: SAMPLE_STACK_ARN + 5
        })
        .resolves({
          Stacks: [{
            StackStatus: 'CREATE_COMPLETE',
            StackName: 'test-stack',
            StackId: 'test-stack/1',
            CreationTime: new Date()
          }]
        })

      await index.maybeStartToMonitorStack(SAMPLE_STACK_ARN + 5)
      await index.maybeStartToMonitorStack(SAMPLE_STACK_ARN + 5)

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(1)
      expect(logLines[0]).to.match(/No operations ongoing/)
    })

    it('should monitor nested stacks as well', async function () {
      const arn6 = (SAMPLE_STACK_ARN + 6).replace('test-stack', 'test-stack-6')
      const arn7 = (SAMPLE_STACK_ARN + 7).replace('test-stack', 'test-stack-7')
      cfMock.on(DescribeStacksCommand, {
        StackName: arn6
      })
        .resolves({
          Stacks: [{
            StackStatus: 'UPDATE_IN_PROGRESS',
            StackName: 'test-stack-6',
            StackId: arn6,
            CreationTime: new Date()
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn6
      }).callsFake(mockCfnEvents.mockDescribeStackEvents([
        [
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack-6',
            PhysicalResourceId: arn6,
            ResourceStatus: 'CREATE_COMPLETE',
            StackId: arn6,
            StackName: 'test-stack-6',
            Timestamp: new Date(),
            EventId: '0004'
          },
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack-7',
            PhysicalResourceId: arn7,
            ResourceStatus: 'CREATE_COMPLETE',
            StackId: arn6,
            StackName: 'test-stack-6',
            Timestamp: new Date(),
            EventId: '0003'
          },
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack-7',
            PhysicalResourceId: arn7,
            ResourceStatus: 'CREATE_IN_PROGRESS',
            StackId: arn6,
            StackName: 'test-stack-6',
            Timestamp: new Date(),
            EventId: '0002'
          },
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack-6',
            PhysicalResourceId: arn6,
            ResourceStatus: 'CREATE_IN_PROGRESS',
            ResourceStatusReason: 'User Initiated',
            StackId: arn6,
            StackName: 'test-stack-6',
            Timestamp: new Date(),
            EventId: '0001'
          }
        ]
      ]))

      cfMock.on(DescribeStacksCommand, {
        StackName: arn7
      })
        .resolves({
          Stacks: [{
            StackStatus: 'CREATE_IN_PROGRESS',
            StackName: 'test-stack-7',
            StackId: arn7,
            CreationTime: new Date()
          }]
        })
      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn7
      }).callsFake(mockCfnEvents.mockDescribeStackEvents([[
        {
          ResourceType: 'AWS::CloudFormation::Stack',
          LogicalResourceId: 'test-stack-7',
          PhysicalResourceId: arn7,
          ResourceStatus: 'CREATE_COMPLETE',
          StackId: arn7,
          StackName: 'test-stack-7',
          Timestamp: new Date(),
          EventId: '0002'
        },
        {
          ResourceType: 'AWS::CloudFormation::Stack',
          LogicalResourceId: 'test-stack-7',
          PhysicalResourceId: arn7,
          ResourceStatus: 'CREATE_IN_PROGRESS',
          ResourceStatusReason: 'User Initiated',
          StackId: arn7,
          StackName: 'test-stack-7',
          Timestamp: new Date(),
          EventId: '0001'
        }
      ]]))

      await index.maybeStartToMonitorStack(arn6)
      expect(getLogLines()).to.have.lengthOf(6)
    })
  })
})
