'use strict'

const pkg = require('./package.json')
const [owner, repo] = new URL(pkg.repository.url).pathname.slice(1).split('/')

const { parallel, series, watch } = require('gulp')
const createTask = require('./gulp.d/lib/create-task')
const exportTasks = require('./gulp.d/lib/export-tasks')
const log = require('fancy-log')

const bundleName = 'ui'
const buildDir = ['deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT) ? 'public/dist' : 'build'
const previewSrcDir = 'preview-src'
const previewDestDir = 'public'
const srcDir = 'src'
const destDir = `${previewDestDir}/_`
const { reload: livereload } = process.env.LIVERELOAD === 'true' ? require('gulp-connect') : {}
const serverConfig = { host: '0.0.0.0', port: 5252, livereload }

const task = require('./gulp.d/tasks')
const glob = {
  all: [srcDir, previewSrcDir],
  css: `${srcDir}/css/**/*.css`,
  js: ['gulpfile.js', 'gulp.d/**/*.js', `${srcDir}/{helpers,js}/**/*.js`],
}

const cleanTask = createTask({
  name: 'clean',
  desc: 'Clean files and folders generated by build',
  call: task.remove(['build', 'public']),
})

const lintCssTask = createTask({
  name: 'lint:css',
  desc: 'Lint the CSS source files using stylelint (standard config)',
  call: task.lintCss(glob.css),
})

const lintJsTask = createTask({
  name: 'lint:js',
  desc: 'Lint the JavaScript source files using eslint (JavaScript Standard Style)',
  call: task.lintJs(glob.js),
})

const lintTask = createTask({
  name: 'lint',
  desc: 'Lint the CSS and JavaScript source files',
  call: parallel(lintCssTask, lintJsTask),
})

const formatTask = createTask({
  name: 'format',
  desc: 'Format the JavaScript source files using prettify (JavaScript Standard Style)',
  call: task.format(glob.js),
})

const buildTask = createTask({
  name: 'build',
  desc: 'Build and stage the UI assets for bundling',
  call: task.build(
    srcDir,
    destDir,
    process.argv.slice(2).some((name) => name.startsWith('preview'))
  ),
})

const bundleBuildTask = createTask({
  name: 'bundle:build',
  call: series(cleanTask, lintTask, buildTask),
})

const bundlePackTask = createTask({
  name: 'bundle:pack',
  desc: 'Create a bundle of the staged UI assets for publishing',
  call: task.pack(
    destDir,
    buildDir,
    bundleName,
    (bundlePath) => !process.env.CI && log(`Antora option: --ui-bundle-url=${bundlePath}`)
  ),
})

const bundleTask = createTask({
  name: 'bundle',
  desc: 'Clean, lint, build, and bundle the UI for publishing',
  call: series(bundleBuildTask, bundlePackTask),
})

const releasePublishTask = createTask({
  name: 'release:publish',
  call: task.release(buildDir, bundleName, owner, repo, process.env.GITHUB_API_TOKEN, true),
})

const releaseTask = createTask({
  name: 'release',
  desc: 'Bundle the UI and publish it to GitHub by attaching it to a new tag',
  call: series(bundleTask, releasePublishTask),
})

const buildPreviewPagesTask = createTask({
  name: 'preview:build-pages',
  call: task.buildPreviewPages(srcDir, previewSrcDir, previewDestDir, livereload),
})

const previewBuildTask = createTask({
  name: 'preview:build',
  desc: 'Process and stage the UI assets and generate pages for the preview',
  call: parallel(buildTask, buildPreviewPagesTask),
})

const previewServeTask = createTask({
  name: 'preview:serve',
  call: task.serve(previewDestDir, serverConfig, () => watch(glob.all, previewBuildTask)),
})

const previewTask = createTask({
  name: 'preview',
  desc: 'Generate a preview site and launch a server to view it',
  call: series(previewBuildTask, previewServeTask),
})

module.exports = exportTasks(
  bundleTask,
  cleanTask,
  lintTask,
  formatTask,
  buildTask,
  bundleTask,
  bundlePackTask,
  releaseTask,
  previewTask,
  previewBuildTask
)