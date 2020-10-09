
$(document).ready(function () {
    $('#mycarousel').carousel({ interval: 8000 });

    $(window).scroll(function () {
        var scroll = $(window).scrollTop();
        //>=, not <=
        if (scroll >= 160) {
            //clearHeader, not clearheader - caps H
            $(".navbar").hide();
        } else {
            $(".navbar").show();
        }
    }); //missing );

});

