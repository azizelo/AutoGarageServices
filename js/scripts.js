
$(function() {
    $('#mycarousel').carousel({ interval: 10000, pause: "false" });
});


$(document).ready(function() {


    $(window).scroll(function() {    
        var scroll = $(window).scrollTop();
    
         //>=, not <=
        if (scroll >= 160) {
            //clearHeader, not clearheader - caps H
            $(".navbar").hide();
        } else {
          $(".navbar").show();
        }
    }); //missing );
      
      
      
      
    
      
    // document ready  
    });