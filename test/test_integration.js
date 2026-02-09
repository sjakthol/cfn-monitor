import { expect } from "chai";
import sinon from "sinon";

import crypto from "crypto";
import {
  CreateStackCommand,
  DeleteStackCommand,
  UpdateStackCommand,
  waitUntilStackCreateComplete,
} from "@aws-sdk/client-cloudformation";

import helpers from "../lib/helpers.js";
import output from "../lib/output.js";

const RUN_ID = Date.now() + "-" + crypto.randomBytes(4).toString("hex");
const client = helpers.getCloudFormationClient({});
const stacks = [];

const WAITER_OPTIONS = {
  maxWaitTime: 120,
  minDelay: 1,
  maxDelay: 1,
};

async function createSampleStack() {
  const StackName = `cfn-monitor-${RUN_ID}-${crypto.randomBytes(4).toString("hex")}`;
  console.error(`Creating stack ${StackName}`);

  const cmd = new CreateStackCommand({
    StackName,
    OnFailure: "DELETE",
    TemplateBody: JSON.stringify({
      Resources: {
        R1: {
          Type: "AWS::CloudFormation::WaitConditionHandle",
        },
      },
    }),
  });
  const res = await client.send(cmd).catch(function (err) {
    if (err.message === "Region is missing") {
      console.error(`Skipping test: ${err.message}`);
      return;
    }
    const skipOnErrors = new Set(["ExpiredToken", "CredentialsError", "AccessDenied"]);
    if (skipOnErrors.has(err.Code)) {
      console.error(`Skipping test: ${err.Code}`);
      return;
    }

    throw err;
  });

  if (res) {
    stacks.push(res.StackId);
    return res.StackId;
  }

  return undefined;
}

describe("integration test", function () {
  this.timeout(120000);
  let logStub;
  const getLogLines = () => logStub.getCalls().map((call) => call.args.join(" "));
  const origArgv = process.argv;
  const sandbox = sinon.createSandbox();

  before(() => {
    logStub = sandbox.spy(output, "write");
    sandbox.stub(process, "exit");
  });

  afterEach(async () => {
    process.argv = origArgv;
    sandbox.reset();
  });

  after(async () => {
    await Promise.all(
      stacks.map(async (stack) => {
        console.error(`Deleting stack ${stack}`);
        await client.send(new DeleteStackCommand({ StackName: stack }));
      }),
    );
  });

  after(() => {
    sandbox.restore();
  });

  it("should monitor in progress stacks correctly", async function () {
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`);
    const stackId = await createSampleStack();
    if (!stackId) {
      return this.skip();
    }
    await index.maybeStartToMonitorStack(stackId);
  });

  it("should handle updates with cleanup steps correctly", async function () {
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`);
    const stackId = await createSampleStack();
    if (!stackId) {
      return this.skip();
    }

    await waitUntilStackCreateComplete({ client, ...WAITER_OPTIONS }, { StackName: stackId });

    await client.send(
      new UpdateStackCommand({
        StackName: stackId,
        TemplateBody: JSON.stringify({
          Resources: {
            R2: {
              Type: "AWS::CloudFormation::WaitConditionHandle",
            },
          },
        }),
      }),
    );
    await index.maybeStartToMonitorStack(stackId);
  });

  it("should monitor multiple in-progress stacks correctly", async function () {
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`);
    const stacks = (await Promise.all([createSampleStack(), createSampleStack()])).filter((s) => s);
    if (stacks.length === 0) {
      return this.skip();
    }

    await Promise.all(stacks.map((stack) => index.maybeStartToMonitorStack(stack)));
  });

  it("should monitor multiple in-progress stacks correctly with startToMonitorInProgressStacks", async function () {
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`);
    const stacks = (await Promise.all([createSampleStack(), createSampleStack()])).filter((s) => s);
    if (stacks.length === 0) {
      return this.skip();
    }

    await index.startToMonitorInProgressStacks();
  });

  it("should monitor deleting stacks correctly with startToMonitorDeletingStacks", async function () {
    const index = await import(`../index.js?version=${Date.now() + Math.random()}`);
    const stack1 = await createSampleStack();
    if (!stack1) {
      return this.skip();
    }

    await waitUntilStackCreateComplete({ client, ...WAITER_OPTIONS }, { StackName: stack1 });

    client.send(new DeleteStackCommand({ StackName: stack1 }));
    await index.startToMonitorDeletingStacks();
  });

  it("should monitor stacks provided as command line arguments", async function () {
    const stacks = (await Promise.all([createSampleStack(), createSampleStack()])).filter((s) => s);
    if (stacks.length === 0) {
      return this.skip();
    }

    process.argv = ["node", "index.js", ...stacks];

    const index = await import(`../index.js?version=${Date.now() + Math.random()}`);
    await Promise.all(await index.run());
  });

  it("should monitor all stacks if no args nor stdin is provided", async function () {
    const stacks = (await Promise.all([createSampleStack(), createSampleStack()])).filter((s) => s);
    if (stacks.length === 0) {
      return this.skip();
    }

    process.argv = ["node", "index.js"];

    const index = await import(`../index.js?version=${Date.now() + Math.random()}`);
    await Promise.all(await index.run());

    const logLines = getLogLines();
    expect(logLines[0]).to.match(/Starting to monitor all stacks that are being modified/);
  });
});
