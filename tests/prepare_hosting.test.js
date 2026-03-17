'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    PUBLIC_ROOT_FILES,
    PUBLIC_DIRECTORIES,
    prepareHostingDirectory,
} = require('../scripts/prepare-hosting');

function makeTempProject() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-hosting-'));
}

describe('prepare-hosting script', () => {
    test('copies only the public web files into site/', () => {
        const projectRoot = makeTempProject();

        for (const fileName of ['index.html', 'app_config.js', 'app_config_shared.js', 'index.js', 'styles.css', 'more_info_2025_12_13.html', 'firebase.json', 'package.json']) {
            fs.writeFileSync(path.join(projectRoot, fileName), fileName, 'utf8');
        }

        fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
        fs.writeFileSync(path.join(projectRoot, 'assets', 'logo.png'), 'asset', 'utf8');

        fs.mkdirSync(path.join(projectRoot, 'data', '3I'), { recursive: true });
        fs.writeFileSync(path.join(projectRoot, 'data', 'objects.json'), '{"objects":["3I"]}', 'utf8');
        fs.writeFileSync(path.join(projectRoot, 'data', '3I', 'trajectory.json'), '{}', 'utf8');

        fs.mkdirSync(path.join(projectRoot, 'tests'), { recursive: true });
        fs.writeFileSync(path.join(projectRoot, 'tests', 'secret.txt'), 'nope', 'utf8');

        const result = prepareHostingDirectory(projectRoot);

        expect(result.copiedFiles).toEqual(expect.arrayContaining([
            'index.html',
            'app_config.js',
            'app_config_shared.js',
            'index.js',
            'styles.css',
            'more_info_2025_12_13.html',
        ]));
        expect(result.copiedDirectories).toEqual(expect.arrayContaining(['assets', 'data']));

        expect(fs.existsSync(path.join(projectRoot, 'site', 'index.html'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, 'site', 'app_config.js'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, 'site', 'app_config_shared.js'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, 'site', 'more_info_2025_12_13.html'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, 'site', 'assets', 'logo.png'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, 'site', 'data', '3I', 'trajectory.json'))).toBe(true);
        expect(fs.existsSync(path.join(projectRoot, 'site', 'firebase.json'))).toBe(false);
        expect(fs.existsSync(path.join(projectRoot, 'site', 'tests'))).toBe(false);
    });

    test('exports the expected public file and directory lists', () => {
        expect(PUBLIC_ROOT_FILES).toEqual(expect.arrayContaining([
            'index.html',
            'object_motion.html',
            'trajectory_player.html',
            'more_info_2025_12_13.html',
            'styles.css',
            'more_info_modal.css',
            'app_config.js',
            'app_config_shared.js',
            'index.js',
            'more_info_shared.js',
            'more_info_modal.js',
        ]));

        for (const removedFile of ['solar_comet.html', 'atlas_journey.html', 'atlas_main.js', 'atlas_data.js']) {
            expect(PUBLIC_ROOT_FILES).not.toContain(removedFile);
        }

        expect(PUBLIC_DIRECTORIES).toEqual(['assets', 'data']);
    });
});
