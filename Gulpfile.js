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
    htmlmin = require('gulp-htmlmin');



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
    if (!imagemin) {
        imagemin = (await import('gulp-imagemin')).default;
    }
    // dynamically import imagemin plugins (ESM) and gulp-rename
    const [mozjpegMod, pngquantMod, gifsicleMod, webpMod, renameMod] = await Promise.all([
        import('imagemin-mozjpeg'),
        import('imagemin-pngquant'),
        import('imagemin-gifsicle'),
        import('imagemin-webp'),
        import('gulp-rename')
    ]);
    const mozjpeg = mozjpegMod.default || mozjpegMod;
    const pngquant = pngquantMod.default || pngquantMod;
    const gifsicle = gifsicleMod.default || gifsicleMod;
    const webp = webpMod.default || webpMod;
    const rename = renameMod.default || renameMod;

    // Optimize originals with tuned options for quality/size balance
    const optimizePlugins = [
        mozjpeg({quality: 82, progressive: true}),
        pngquant({quality: [0.7, 0.85]}),
        gifsicle({optimizationLevel: 2})
    ];

    // Stream: optimize originals
    const optimized = gulp.src('img/*.{png,jpg,jpeg,gif,svg}')
        .pipe(imagemin(optimizePlugins))
        .pipe(gulp.dest('dist/img'));

    // Additionally generate WebP versions for browsers that support it
    const webps = gulp.src('img/*.{png,jpg,jpeg}')
        .pipe(imagemin([ webp({quality: 75}) ]))
        .pipe(rename({ extname: '.webp' }))
        .pipe(gulp.dest('dist/img'));

    // wait for streams to finish before post-processing
    const streamToPromise = s => new Promise((resolve, reject) => s.on('end', resolve).on('error', reject));
    await Promise.all([streamToPromise(optimized), streamToPromise(webps)]);

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
gulp.task('build', gulp.series('clean', 'copyfonts', 'copyvcf', 'copycname', 'imagemin', 'usemin'));

gulp.task('default', gulp.parallel('browser-sync','sass:watch'));
