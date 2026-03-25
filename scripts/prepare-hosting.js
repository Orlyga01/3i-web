'use strict';

const fs = require('fs');
const path = require('path');

const PUBLIC_ROOT_FILES = Object.freeze([
    'index.html',
    'object_motion.html',
    'presentation.html',
    'trajectory_player.html',
    'more_info_2025_12_13.html',
    'solar_system.html',
    'anomalies_panel.html',
    'styles.css',
    'anomalies_panel.css',
    'more_info_modal.css',
    'app_config.js',
    'app_config_shared.js',
    'index.js',
    'translations.js',
    'more_info_shared.js',
    'more_info_modal.js',
    'anomalies_shared.js',
    'anomalies_panel.js',
    'object_motion.js',
    'presentation.js',
    'trajectory_player.js',
    'solar_system.js',
    'shared_render.js',
    'main.js',
]);

const PUBLIC_DIRECTORIES = Object.freeze([
    'assets',
    'data',
    'slides',
]);

function ensureCleanDirectory(targetDirectory) {
    fs.rmSync(targetDirectory, { recursive: true, force: true });
    fs.mkdirSync(targetDirectory, { recursive: true });
}

function copyIfExists(sourcePath, destinationPath) {
    if (!fs.existsSync(sourcePath)) return false;
    fs.cpSync(sourcePath, destinationPath, { recursive: true });
    return true;
}

function prepareHostingDirectory(projectRoot, outputDirectoryName = 'site') {
    const outputDirectory = path.join(projectRoot, outputDirectoryName);
    ensureCleanDirectory(outputDirectory);

    const copiedFiles = [];
    const copiedDirectories = [];

    for (const fileName of PUBLIC_ROOT_FILES) {
        const sourcePath = path.join(projectRoot, fileName);
        const destinationPath = path.join(outputDirectory, fileName);
        if (copyIfExists(sourcePath, destinationPath)) copiedFiles.push(fileName);
    }

    for (const dirName of PUBLIC_DIRECTORIES) {
        const sourcePath = path.join(projectRoot, dirName);
        const destinationPath = path.join(outputDirectory, dirName);
        if (copyIfExists(sourcePath, destinationPath)) copiedDirectories.push(dirName);
    }

    return {
        outputDirectory,
        copiedFiles,
        copiedDirectories,
    };
}

if (require.main === module) {
    const projectRoot = path.resolve(__dirname, '..');
    const result = prepareHostingDirectory(projectRoot);
    console.log(
        `[prepare-hosting] Prepared ${result.outputDirectory} with ${result.copiedFiles.length} files and ${result.copiedDirectories.length} directories`
    );
}

module.exports = {
    PUBLIC_ROOT_FILES,
    PUBLIC_DIRECTORIES,
    ensureCleanDirectory,
    prepareHostingDirectory,
};
