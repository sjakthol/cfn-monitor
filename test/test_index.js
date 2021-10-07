/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.use(require('dirty-chai'))
const mockStdin = require('mock-stdin')

const { mockClient } = require('aws-sdk-client-mock')
const {
  CloudFormationClient,
  DescribeStacksCommand,
  DescribeStackEventsCommand,
  ListStacksCommand
} = require('@aws-sdk/client-cloudformation')

const output = require('../lib/output')
const mockCfnEvents = require('./mock-cfn-events')

const SAMPLE_STACK_ARN = 'arn:aws:cloudformation:eu-west-1:0123456789012:stack/test-stack/1'

describe('index', function () {
  /**
   * @typedef {import('aws-sdk-client-mock').AwsStub} AwsStub
   * @type {AwsStub}
   **/
  let cfMock
  /** @type {sinon.SinonStub} */
  let logStub
  /** @type {mockStdin.MockSTDIN} */
  let stdinMock
  /** @type {sinon.SinonSandbox} */
  let sandbox

  let index

  const getLogLines = () => logStub.getCalls().map(call => call.args.join(' '))
  const getSampleArn = n => (SAMPLE_STACK_ARN + n).replace('test-stack', `test-stack-${n}`)
  const origArgv = process.argv

  before(() => {
    cfMock = mockClient(CloudFormationClient)
    sandbox = sinon.createSandbox()
    logStub = sandbox.stub(output, 'write')
    sandbox.stub(process, 'exit')
    stdinMock = mockStdin.stdin()
  })

  beforeEach(() => {
    delete require.cache[require.resolve('../index')]
    index = require('../index')
    logStub.returns(null)
  })

  afterEach(() => {
    cfMock.reset()
    sandbox.reset()
    stdinMock.reset()
    process.argv = origArgv
  })

  after(() => {
    cfMock.restore()
    sandbox.restore()
    stdinMock.restore()
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

    it('should monitor the same stack twice', async function () {
      const arn5 = getSampleArn(5)

      // First attempt: no operations ongoing
      cfMock
        .on(DescribeStacksCommand, {
          StackName: arn5
        })
        .resolves({
          Stacks: [{
            StackStatus: 'CREATE_COMPLETE',
            StackName: 'test-stack',
            StackId: arn5,
            CreationTime: new Date()
          }]
        })

      await index.maybeStartToMonitorStack(arn5)

      // Second attempt: update has started
      cfMock.reset()
      cfMock
        .on(DescribeStacksCommand, {
          StackName: arn5
        })
        .resolves({
          Stacks: [{
            StackStatus: 'UPDATE_IN_PROGRESS',
            StackName: 'test-stack-5',
            StackId: arn5,
            CreationTime: new Date()
          }]
        })
      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn5
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.updateStackEvents(arn5, 'test-stack-5')
      ))
      await index.maybeStartToMonitorStack(arn5)

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(3)
      expect(logLines[0]).to.match(/No operations ongoing/)
      expect(logLines[1]).to.match(/UPDATE_IN_PROGRESS/)
      expect(logLines[2]).to.match(/UPDATE_COMPLETE/)
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
            ResourceStatus: 'UPDATE_COMPLETE',
            StackId: arn6,
            StackName: 'test-stack-6',
            Timestamp: new Date(),
            EventId: '0003'
          },
          {
            ResourceType: 'AWS::CloudFormation::Stack',
            LogicalResourceId: 'test-stack-7',
            PhysicalResourceId: arn7,
            ResourceStatus: 'UPDATE_IN_PROGRESS',
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
            CreationTime: new Date(),
            StackId: arn7,
            StackName: 'test-stack-7',
            StackStatus: 'UPDATE_IN_PROGRESS'
          }]
        })
      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn7
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.updateStackEvents(arn7, 'test-stack-7')
      ))

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
            CreationTime: new Date(),
            StackId: arn8,
            StackName: 'test-stack-8',
            StackStatus: 'UPDATE_IN_PROGRESS'
          },
          {
            CreationTime: new Date(),
            StackId: arn9,
            StackName: 'test-stack-9',
            StackStatus: 'UPDATE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStacksCommand, {
        StackName: arn8
      })
        .resolves({
          Stacks: [{
            CreationTime: new Date(),
            StackId: arn8,
            StackName: 'test-stack-8',
            StackStatus: 'UPDATE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStacksCommand, {
        StackName: arn9
      })
        .resolves({
          Stacks: [{
            CreationTime: new Date(),
            StackId: arn9,
            StackName: 'test-stack-9',
            StackStatus: 'UPDATE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn8
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.updateStackEvents(arn8, 'test-stack-8')
      ))

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn9
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.updateStackEvents(arn9, 'test-stack-9')
      ))

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
            CreationTime: new Date(),
            StackId: arn10,
            StackName: 'test-stack-10',
            StackStatus: 'UPDATE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStacksCommand, {
        StackName: arn10
      })
        .resolves({
          Stacks: [{
            CreationTime: new Date(),
            StackId: arn10,
            StackName: 'test-stack-10',
            StackStatus: 'DELETE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn10
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.deleteStackEvents(arn10, 'test-stack-10')
      ))

      await index.startToMonitorDeletingStacks()

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(3)
      expect(logLines[0]).to.match(/1 stack is being deleted./)
    })
  })

  describe('run', function () {
    it('should start to monitor deleting stacks if stdin is empty', async function () {
      const arn11 = getSampleArn(11)
      cfMock.on(ListStacksCommand)
        .resolves({
          StackSummaries: [{
            CreationTime: new Date(),
            StackId: arn11,
            StackName: 'test-stack-11',
            StackStatus: 'DELETE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStacksCommand, {
        StackName: arn11
      })
        .resolves({
          Stacks: [{
            StackStatus: 'DELETE_IN_PROGRESS',
            StackName: 'test-stack-11',
            StackId: arn11,
            CreationTime: new Date()
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn11
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.deleteStackEvents(arn11, 'test-stack-11')
      ))

      const runPromise = index.run()
      stdinMock.end()
      const runPromises = await runPromise
      await Promise.all(runPromises)

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(4)
      expect(logLines[0]).to.match(/Starting to monitor stacks that are being deleted./)
      expect(logLines[1]).to.match(/1 stack is being deleted./)
      expect(logLines[3]).to.match(/test-stack-11./)
    })

    it('should start to monitor all stacks if stdin indicates aws cloudformation deploy cmd', async function () {
      const arn12 = getSampleArn(12)
      const arn13 = getSampleArn(13)
      cfMock.on(ListStacksCommand)
        .resolves({
          StackSummaries: [{
            CreationTime: new Date(),
            StackId: arn12,
            StackName: 'test-stack-12',
            StackStatus: 'DELETE_IN_PROGRESS'
          }, {
            CreationTime: new Date(),
            StackId: arn13,
            StackName: 'test-stack-13',
            StackStatus: 'UPDATE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStacksCommand, { StackName: arn12 })
        .resolves({
          Stacks: [{
            StackStatus: 'DELETE_IN_PROGRESS',
            StackName: 'test-stack-12',
            StackId: arn12,
            CreationTime: new Date()
          }]
        })
      cfMock.on(DescribeStacksCommand, { StackName: arn13 })
        .resolves({
          Stacks: [{
            StackStatus: 'UPDATE_IN_PROGRESS',
            StackName: 'test-stack-13',
            StackId: arn13,
            CreationTime: new Date()
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn12
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.deleteStackEvents(arn12, 'test-stack-12')
      ))

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn13
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.updateStackEvents(arn13, 'test-stack-13')
      ))

      const runPromise = index.run()
      stdinMock.send('Waiting for stack create/update to complete\n')
      stdinMock.send('Waiting for stack create/update to complete\n')
      stdinMock.end()
      await Promise.all(await runPromise)

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(6)
      expect(logLines[0]).to.match(/aws cloudformation deploy/)
    })

    it('should start to monitor stacks from stdin and argv', async function () {
      const arn14 = getSampleArn(14)
      const arn15 = getSampleArn(15)
      cfMock.on(ListStacksCommand)
        .resolves({
          StackSummaries: [{
            CreationTime: new Date(),
            StackId: arn14,
            StackName: 'test-stack-14',
            StackStatus: 'DELETE_IN_PROGRESS'
          }, {
            CreationTime: new Date(),
            StackId: arn15,
            StackName: 'test-stack-15',
            StackStatus: 'UPDATE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStacksCommand, { StackName: arn14 })
        .resolves({
          Stacks: [{
            StackStatus: 'DELETE_IN_PROGRESS',
            StackName: 'test-stack-14',
            StackId: arn14,
            CreationTime: new Date()
          }]
        })
      cfMock.on(DescribeStacksCommand, { StackName: arn15 })
        .resolves({
          Stacks: [{
            StackStatus: 'UPDATE_IN_PROGRESS',
            StackName: 'test-stack-15',
            StackId: arn15,
            CreationTime: new Date()
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn14
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.deleteStackEvents(arn14, 'test-stack-14')
      ))

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn15
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.updateStackEvents(arn15, 'test-stack-15')
      ))

      // arn14 to argv
      process.argv = ['node', 'index.js', arn14]

      const runPromise = index.run()

      // arn15 to stdin
      stdinMock.send(`"StackArn": "${arn15}"\n`)
      stdinMock.end()
      await Promise.all(await runPromise)

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(4)
      for (const line of logLines) {
        expect(line).to.match(/test-stack-(14|15)/)
      }
    })

    it('should start to monitor all stacks if there is no stdin or argv', async function () {
      const arn16 = getSampleArn(16)
      cfMock.on(ListStacksCommand)
        .resolves({
          StackSummaries: [{
            CreationTime: new Date(),
            StackId: arn16,
            StackName: 'test-stack-16',
            StackStatus: 'UPDATE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStacksCommand, { StackName: arn16 })
        .resolves({
          Stacks: [{
            StackStatus: 'UPDATE_IN_PROGRESS',
            StackName: 'test-stack-16',
            StackId: arn16,
            CreationTime: new Date()
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn16
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.updateStackEvents(arn16, 'test-stack-16')
      ))

      process.stdin.isTTY = true
      await Promise.all(await index.run())

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(4)
      expect(logLines[0]).to.match(/No input nor stacks from the command line/)
      expect(logLines[1]).to.match(/1 stack is being changed/)
      expect(logLines[2]).to.match(/test-stack-16/)
    })

    it('should start to monitor argv only if there is no stdin', async function () {
      const arn17 = getSampleArn(17)
      cfMock.on(ListStacksCommand)
        .resolves({
          StackSummaries: [{
            CreationTime: new Date(),
            StackId: arn17,
            StackName: 'test-stack-17',
            StackStatus: 'UPDATE_IN_PROGRESS'
          }]
        })

      cfMock.on(DescribeStacksCommand, { StackName: arn17 })
        .resolves({
          Stacks: [{
            StackStatus: 'UPDATE_IN_PROGRESS',
            StackName: 'test-stack-17',
            StackId: arn17,
            CreationTime: new Date()
          }]
        })

      cfMock.on(DescribeStackEventsCommand, {
        StackName: arn17
      }).callsFake(mockCfnEvents.mockDescribeStackEvents(
        mockCfnEvents.updateStackEvents(arn17, 'test-stack-17')
      ))

      process.stdin.isTTY = true
      process.argv = ['node', 'index.js', arn17]
      await Promise.all(await index.run())

      const logLines = getLogLines()
      expect(logLines).to.have.lengthOf(2)
      expect(logLines[0]).to.match(/test-stack-17/)
    })
  })
})
