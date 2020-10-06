
$(document).ready(function () {
    $('#mycarousel').carousel({ interval: 10000, pause: "false" });
    $('#carouselButton').click(function () {
        if ($('#carouselButton').children('span').hasClass('fa fa-pause')) {
            $('#mycarousel').carousel('pause');
            $('#carouselButton').children('span').removeClass('fa-pause');
            $('#carouselButton').children('span').addClass('fa-play');

        }
        else if ($('#carouselButton').children('span').hasClass('fa fa-play')) {
            $('#mycarousel').carousel('cycle');
            $('#carouselButton').children('span').removeClass('fa-play');
            $('#carouselButton').children('span').addClass('fa-pause');

        }
    });

    $('#reserveButton').click(function () {
        $('#reserveModal').modal('toggle');
    });

});
