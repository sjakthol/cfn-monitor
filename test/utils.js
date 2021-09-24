/**
 * Collect elements of async generator to array.
 *
 * @param {*} gen Async generator to collect
 * @returns list
 */
async function asyncGeneratorToArray (gen) {
  const array = []
  for await (const item of gen) {
    array.push(item)
  }

  return array
}

module.exports = {
  asyncGeneratorToArray
}
