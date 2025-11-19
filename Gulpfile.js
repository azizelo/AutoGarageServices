'use strict';

var gulp = require('gulp'),
    sass = require('gulp-sass')(require('sass')),
    browserSync = require('browser-sync'),
    del = require('del'),
    imagemin = null,
    fs = require('fs'),
    uglify = require('gulp-uglify'),
    usemin = require('gulp-usemin'),
    rev = require('gulp-rev'),
    cleanCss = require('gulp-clean-css'),
    flatmap = require('gulp-flatmap'),
    newer = require('gulp-newer'),
    { minify: htmlMinify } = require('html-minifier-terser'),
    through = require('through2');

// Small wrapper to provide a gulp-like htmlmin stream API using html-minifier-terser
function htmlmin(opts){
    return through.obj(function(file, enc, cb){
        if (file.isBuffer()){
            htmlMinify(String(file.contents), opts).then(minified => {
                file.contents = Buffer.from(minified);
                cb(null, file);
            }).catch(cb);
        } else if (file.isStream()){
            let data = '';
            file.contents.on('data', chunk => data += chunk);
            file.contents.on('end', () => {
                htmlMinify(data, opts).then(minified => {
                    file.contents = Buffer.from(minified);
                    cb(null, file);
                }).catch(cb);
            });
        } else {
            cb(null, file);
        }
    });
}



gulp.task('sass', function(){
    return gulp.src('./css/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('./css'));

});

gulp.task('sass:watch', function(){
    gulp.watch('./css/*.scss', gulp.series('sass'));
});

gulp.task('browser-sync', function() {
    var files = [
        './*.html',
        './css/*.css',
        './js/*.js',
        './img/*.{png,jpg,gif}'
    ];

    browserSync.init(files, {
        server: {
            baseDir: './'
        }
    });
});

//clean
gulp.task('clean', function(){
    return del(['dist']);
});

//copy files
gulp.task('copyfonts', function(){
    // copy font files from node_modules (font-awesome) and project `fonts/` directory
    // Do NOT pipe fonts through image optimization — copy them as-is.
    return gulp.src([
        './node_modules/font-awesome/fonts/**/*.{eot,woff,woff2,ttf,svg}',
        './fonts/**/*.{eot,woff,woff2,ttf,svg}'
    ], { allowEmpty: true })
    .pipe(gulp.dest('./dist/fonts'));
});

//copy contact card
gulp.task('copyvcf', function(){
    return gulp.src('./AutoGarageServices.vcf')
    .pipe(gulp.dest('./dist'));

});

//copy CNAME File
gulp.task('copycname', function(){
    return gulp.src('./CNAME')
    .pipe(gulp.dest('./dist'));

});

gulp.task('imagemin', async function(){
    // Use sharp for JPEG/PNG optimization and WebP generation to avoid transitive
    // vulnerabilities in the imagemin binary-download toolchain. This task will
    // only re-process images when the source is newer than the destination.
    const sharp = require('sharp');
    const path = require('path');
    const srcDir = 'img';
    const distDir = 'dist/img';
    await fs.promises.mkdir(distDir, { recursive: true });

    const files = (await fs.promises.readdir(srcDir)).filter(f => /\.(png|jpe?g|gif|svg)$/i.test(f));
    for (const f of files) {
        const inPath = path.join(srcDir, f);
        const ext = path.extname(f).toLowerCase();
        const base = path.basename(f, ext);
        const outPath = path.join(distDir, f);
        try {
            const srcStat = await fs.promises.stat(inPath);
            const destStat = await fs.promises.stat(outPath).catch(() => null);
            if (destStat && destStat.mtimeMs >= srcStat.mtimeMs) {
                // destination is up-to-date
                continue;
            }

            if (ext === '.jpg' || ext === '.jpeg') {
                await sharp(inPath).jpeg({ quality: 82, mozjpeg: true }).toFile(outPath);
                // webp
                await sharp(inPath).webp({ quality: 75 }).toFile(path.join(distDir, `${base}.webp`));
            } else if (ext === '.png') {
                await sharp(inPath).png({ compressionLevel: 9 }).toFile(outPath);
                await sharp(inPath).webp({ quality: 75 }).toFile(path.join(distDir, `${base}.webp`));
            } else {
                // gif/svg or others — copy verbatim
                await fs.promises.copyFile(inPath, outPath);
            }
        } catch (err) {
            // ignore single-file errors but log to console for visibility
            console.error('imagemin(sharp) error for', f, err && err.message);
        }
    }

    // After optimization, ensure we never keep an optimized file larger than the original.
    await ensureOptimizedIsSmaller();
    return Promise.resolve();
});

async function ensureOptimizedIsSmaller(){
    const srcDir = 'img';
    const distDir = 'dist/img';
    const files = (await fs.promises.readdir(srcDir)).filter(f => /\.(png|jpe?g|gif|svg)$/.test(f));
    for(const f of files){
        try{
            const srcStat = await fs.promises.stat(`${srcDir}/${f}`);
            const distPath = `${distDir}/${f}`;
            const distStat = await fs.promises.stat(distPath).catch(()=>null);
            if(distStat && srcStat.size < distStat.size){
                // original is smaller — copy it over
                await fs.promises.copyFile(`${srcDir}/${f}`, distPath);
            }
        }catch(e){
            // ignore missing files
        }
    }
}





gulp.task('usemin', function (){
    return gulp.src('./*.html').pipe(flatmap(function(stream, file){
        return stream
        .pipe(usemin({
            css: [ rev()],
            html:[ function(){
                return htmlmin({collapseWhitespace: true})}],
                js:[uglify(), rev()],
                inlinejs: [uglify()],
                inlinecss: [cleanCss(), 'concat']
        }))
    }))
    .pipe(gulp.dest('dist/'));
});
// Build: ensure fonts are copied (unmodified) before image tasks/usemin
// Replace known font query version tokens in built CSS with a timestamped token
// to force browsers to re-fetch fonts after a deploy (cache-bust).
gulp.task('bust-font-cache', async function(){
    const cssDir = 'dist/css';
    const token = Date.now();
    try{
        const files = await fs.promises.readdir(cssDir);
        const cssFiles = files.filter(f => f.endsWith('.css'));
        for(const f of cssFiles){
            const p = `${cssDir}/${f}`;
            let content = await fs.promises.readFile(p, 'utf8');
            // Replace the FontAwesome v token (e.g. ?v=4.7.0) with a timestamped variant
            content = content.replace(/(fontawesome-webfont\.(?:eot|woff2|woff|ttf|svg)\?v=)([0-9\.\-a-zA-Z_]+)/g, `$1$2.${token}`);
            await fs.promises.writeFile(p, content, 'utf8');
        }
    }catch(e){
        // ignore if dist/css missing
    }
    return Promise.resolve();
});

gulp.task('build', gulp.series('clean', 'copyfonts', 'copyvcf', 'copycname', 'imagemin', 'usemin', 'bust-font-cache'));

gulp.task('default', gulp.parallel('browser-sync','sass:watch'));
