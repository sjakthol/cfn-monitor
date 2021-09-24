/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.use(require('dirty-chai'))

const { mockClient } = require('aws-sdk-client-mock')
const { CloudFormationClient, DescribeStacksCommand, DescribeStackEventsCommand, ListStacksCommand } = require('@aws-sdk/client-cloudformation')

const index = require('../index')
const output = require('../lib/output')
const mockCfnEvents = require('./mock-cfn-events')

const SAMPLE_STACK_ARN = 'arn:aws:cloudformation:eu-west-1:0123456789012:stack/test-stack/1'

describe('index', function () {
  let cfMock
  let logStub
  let sandbox

  const getLogLines = () => logStub.getCalls().map(call => call.args.join(' '))
  const getSampleArn = n => (SAMPLE_STACK_ARN + n).replace('test-stack', `test-stack-${n}`)

  before(() => {
    cfMock = mockClient(CloudFormationClient)
    sandbox = sinon.createSandbox()
    logStub = sandbox.stub(output, 'write')
    sandbox.stub(process, 'exit')
  })

  beforeEach(() => {
    logStub.returns(null)
  })

  afterEach(() => {
    cfMock.reset()
    sandbox.reset()
  })

  after(() => {
    cfMock.restore()
    sandbox.restore()
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
      const arn6 = getSampleArn(6)
      const arn7 = getSampleArn(7)
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

  describe('startToMonitorInProgressStacks', function () {
    it('should exit of no stacks are modified', async function () {
      cfMock.on(ListStacksCommand)
        .resolves({
          StackSummaries: []
        })

      await index.startToMonitorInProgressStacks()

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(1)
      expect(logLines[0]).to.match(/No stacks are being created/)
    })

    it('should start to monitor in-progress stacks', async function () {
      const arn8 = getSampleArn(8)
      const arn9 = getSampleArn(9)
      cfMock.on(ListStacksCommand)
        .resolves({
          StackSummaries: [{
            StackId: arn8
          },
          {
            StackId: arn9
          }]
        })

      cfMock.on(DescribeStacksCommand, {
        StackName: arn8
      })
        .resolves({
          Stacks: [{
            StackStatus: 'CREATE_IN_PROGRESS',
            StackName: 'test-stack-8',
            StackId: arn8,
            CreationTime: new Date()
          }]
        })

      cfMock.on(DescribeStacksCommand, {
        StackName: arn9
      })
        .resolves({
          Stacks: [{
            StackStatus: 'CREATE_IN_PROGRESS',
            StackName: 'test-stack-9',
            StackId: arn9,
            CreationTime: new Date()
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn8
      })
        .callsFake(mockCfnEvents.mockDescribeStackEvents([[
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack-8',
            PhysicalResourceId: arn8,
            ResourceStatus: 'CREATE_COMPLETE',
            StackId: arn8,
            StackName: 'test-stack-8',
            Timestamp: new Date(),
            EventId: '0002'
          },
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack-8',
            PhysicalResourceId: arn8,
            ResourceStatus: 'CREATE_IN_PROGRESS',
            ResourceStatusReason: 'User Initiated',
            StackId: arn8,
            StackName: 'test-stack-8',
            Timestamp: new Date(),
            EventId: '0001'
          }
        ]]))
      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn9
      }).callsFake(mockCfnEvents.mockDescribeStackEvents([[
        {
          ResourceType: 'AWS::CloudFormation::Stack',
          LogicalResourceId: 'test-stack-9',
          PhysicalResourceId: arn9,
          ResourceStatus: 'CREATE_COMPLETE',
          StackId: arn9,
          StackName: 'test-stack-9',
          Timestamp: new Date(),
          EventId: '0002'
        },
        {
          ResourceType: 'AWS::CloudFormation::Stack',
          LogicalResourceId: 'test-stack-9',
          PhysicalResourceId: arn9,
          ResourceStatus: 'CREATE_IN_PROGRESS',
          ResourceStatusReason: 'User Initiated',
          StackId: arn9,
          StackName: 'test-stack-9',
          Timestamp: new Date(),
          EventId: '0001'
        }
      ]]))

      await index.startToMonitorInProgressStacks()

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(5)
      expect(logLines[0]).to.match(/2 stacks are being changed./)
    })
  })

  describe('startToMonitorDeletingStacks', function () {
    it('should exit of no stacks are being deleted', async function () {
      cfMock.on(ListStacksCommand)
        .resolves({
          StackSummaries: []
        })

      await index.startToMonitorDeletingStacks()

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(1)
      expect(logLines[0]).to.match(/No stacks are being deleted/)
    })

    it('should start to monitor deleting stacks', async function () {
      const arn10 = getSampleArn(10)
      cfMock.on(ListStacksCommand)
        .resolves({
          StackSummaries: [{
            StackId: arn10
          }]
        })

      cfMock.on(DescribeStacksCommand, {
        StackName: arn10
      })
        .resolves({
          Stacks: [{
            StackStatus: 'DELETE_IN_PROGRESS',
            StackName: 'test-stack-10',
            StackId: arn10,
            CreationTime: new Date()
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn10
      })
        .callsFake(mockCfnEvents.mockDescribeStackEvents([[
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack-10',
            PhysicalResourceId: arn10,
            ResourceStatus: 'DELETE_COMPLETE',
            StackId: arn10,
            StackName: 'test-stack-10',
            Timestamp: new Date(),
            EventId: '0002'
          },
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack-10',
            PhysicalResourceId: arn10,
            ResourceStatus: 'DELETE_IN_PROGRESS',
            ResourceStatusReason: 'User Initiated',
            StackId: arn10,
            StackName: 'test-stack-10',
            Timestamp: new Date(),
            EventId: '0001'
          }
        ]]))

      await index.startToMonitorDeletingStacks()

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(3)
      expect(logLines[0]).to.match(/1 stack is being deleted./)
    })
  })
})
