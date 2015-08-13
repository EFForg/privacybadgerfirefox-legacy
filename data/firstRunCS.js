$(function(){
  $(".jcarousel-control-next").click(setSeenComic);
  $(".jcarousel-pagination").click(setSeenComic);
  $(document).on('keyup', function(e){
    var key = e.which || e.keyChar || e.keyCode;
    if (key == 37 || key == 39)  { // L/R Arrow
      setSeenComic();
    }
  })

  function setSeenComic() {
    self.port.emit("setSeenComic", true);
  };
});
