'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    extractDesignation,
    collectObjectsFromDataDirectory,
    buildManifestDocument,
    writeObjectManifest,
} = require('../scripts/generate-object-manifest');

function makeTempProject() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'object-manifest-'));
}

describe('generate-object-manifest script', () => {
    test('extracts designation from trajectory metadata with folder fallback', () => {
        expect(extractDesignation('3I', { designation: '3I/ATLAS' })).toBe('3I/ATLAS');
        expect(extractDesignation('C_2025_N1', { object: 'C/2025 N1' })).toBe('C/2025 N1');
        expect(extractDesignation('3I', {})).toBe('3I');
    });

    test('collects objects from data subfolders containing trajectory.json', () => {
        const projectRoot = makeTempProject();
        const dataDir = path.join(projectRoot, 'data');
        fs.mkdirSync(dataDir, { recursive: true });

        fs.mkdirSync(path.join(dataDir, '3I'));
        fs.writeFileSync(
            path.join(dataDir, '3I', 'trajectory.json'),
            JSON.stringify({ designation: '3I' }),
            'utf8'
        );

        fs.mkdirSync(path.join(dataDir, 'C_2025_N1'));
        fs.writeFileSync(
            path.join(dataDir, 'C_2025_N1', 'trajectory.json'),
            JSON.stringify({ designation: 'C/2025 N1' }),
            'utf8'
        );

        fs.mkdirSync(path.join(dataDir, 'notes'));

        expect(collectObjectsFromDataDirectory(dataDir)).toEqual(['3I', 'C/2025 N1']);
    });

    test('falls back to folder names when trajectory json is invalid', () => {
        const projectRoot = makeTempProject();
        const dataDir = path.join(projectRoot, 'data');
        fs.mkdirSync(path.join(dataDir, 'Broken_Object'), { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'Broken_Object', 'trajectory.json'), '{', 'utf8');

        expect(collectObjectsFromDataDirectory(dataDir)).toEqual(['Broken_Object']);
    });

    test('writes data/objects.json manifest for the project root', () => {
        const projectRoot = makeTempProject();
        const dataDir = path.join(projectRoot, 'data');
        fs.mkdirSync(path.join(dataDir, '3I'), { recursive: true });
        fs.writeFileSync(
            path.join(dataDir, '3I', 'trajectory.json'),
            JSON.stringify({ designation: '3I' }),
            'utf8'
        );

        const result = writeObjectManifest(projectRoot);
        expect(result.objects).toEqual(['3I']);
        expect(buildManifestDocument(result.objects)).toEqual({ objects: ['3I'] });

        const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, 'objects.json'), 'utf8'));
        expect(manifest).toEqual({ objects: ['3I'] });
    });
});
