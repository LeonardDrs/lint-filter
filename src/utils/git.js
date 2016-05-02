import _ from 'lodash'
import cp from 'child_process'
import Promise from 'bluebird'

export const spawn = (file, args) => new Promise((resolve, reject) => {
  let stdout = ''
  let stderr = ''

  const process = cp.spawn(file, args)
  process.stdout.on('data', data => { stdout += data })
  process.stderr.on('data', data => { stderr += data })

  process.on('close', code => {
    if (code === 0) {
      resolve(stdout)
    } else {
      const error = new Error(`${file} ${args.join(' ')} failed`)
      error.stdout = stdout
      error.stderr = stderr
      error.code = code
      reject(error)
    }
  })
})

export function parseDiffRanges(diff) {
  const matches = diff.match(/^@@ -\d+,\d+ \+(\d+),(\d+) @@/gm)
  if (!_.isEmpty(matches)) {
    return matches.map(match => {
      const [start, end] = /^@@ -\d+,\d+ \+(\d+),(\d+) @@/.exec(match).slice(1, 3)
      return [parseInt(start, 10), parseInt(start, 10) + parseInt(end, 10)]
    })
  }
  return []
}

const filenameRegex = /^a\/([^\n]+) b\/[^\n]+/
export function parseDiffForFile(diff) {
  const matches = filenameRegex.exec(diff)
  if (matches === null) {
    return null
  }
  const filename = matches[1]
  return { filename, ranges: parseDiffRanges(diff) }
}

export function parseFullDiff(diff) {
  return _(`\n${diff}`.split('\ndiff --git '))
    .map(parseDiffForFile)
    .filter(_.isObject)
    .reduce((lastValue, { filename, ranges }) => _.assign(
      {},
      lastValue,
      { [filename]: lastValue[filename] ? _.concat(lastValue[filename], ranges) : ranges })
    , {})
}

export async function getDiffInformation({ branch = 'origin/master', hash } = {}) {
  const diffAgainst = hash || await exports.spawn('git', ['merge-base', branch, 'HEAD'])
  return parseFullDiff(await exports.spawn('git', ['diff', diffAgainst.trim()]))
}
