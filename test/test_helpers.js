/* eslint-env mocha */
const chai = require('chai')
const expect = chai.expect

const helpers = require('../lib/helpers')

describe('helpers module', function () {
  describe('getStackInfoFromInput()', function () {
    const cases = [{
      desc: 'text input',
      input: 'arn:aws:cloudformation:eu-west-1:000000000000:stack/test/c785c2b0-63fc-11e7-94dc-500c423e34d2\n',
      output: {
        arn: 'arn:aws:cloudformation:eu-west-1:000000000000:stack/test/c785c2b0-63fc-11e7-94dc-500c423e34d2',
        region: 'eu-west-1',
        name: 'test'
      }
    }, {
      desc: 'table input',
      input: '--------------------------------------------------------------------------------------------------------------\n' +
             '|                                                 UpdateStack                                                |\n' +
             '+---------+--------------------------------------------------------------------------------------------------+\n' +
             '|  StackId|  arn:aws:cloudformation:eu-west-1:000000000000:stack/test/c785c2b0-63fc-11e7-94dc-500c423e34d2   |\n' +
             '+---------+--------------------------------------------------------------------------------------------------+\n',
      output: {
        arn: 'arn:aws:cloudformation:eu-west-1:000000000000:stack/test/c785c2b0-63fc-11e7-94dc-500c423e34d2',
        region: 'eu-west-1',
        name: 'test'
      }
    }, {
      desc: 'json input',
      input: '{\n' +
             '    "StackId": "arn:aws:cloudformation:eu-west-1:000000000000:stack/test/c785c2b0-63fc-11e7-94dc-500c423e34d2"\n' +
             '}\n',
      output: {
        arn: 'arn:aws:cloudformation:eu-west-1:000000000000:stack/test/c785c2b0-63fc-11e7-94dc-500c423e34d2',
        region: 'eu-west-1',
        name: 'test'
      }
    }, {
      desc: 'empty input',
      input: '',
      output: null
    }, {
      desc: 'whitespace only input',
      input: '\n',
      output: null
    }]

    cases.forEach(function (test) {
      it('parses ' + test.desc + ' correctly', function () {
        expect(helpers.getStackInfoFromInput(test.input)).to.deep.equal(test.output)
      })
    })
  })
})
