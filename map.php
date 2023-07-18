<?php


add_shortcode('chrisvf_map', 'chrisvf_render_map');

add_action( 'wp_enqueue_scripts', 'chrisvf_add_map_scripts' );
function chrisvf_add_map_scripts() {
    wp_register_script( 'chrisvf-leaflet', plugins_url('leaflet.js', __FILE__) );
    wp_register_style( 'chrisvf-leaflet', plugins_url('leaflet.css', __FILE__) );
}

/*********************************************************************************
 MAP
 *********************************************************************************/

// to add the map; ensure that page-cleanpage.php is added to the templates folder of whatever theme the site uses and the page with the map slug in uses that template.

function chrisvf_render_map() {
  $warnings = [];

  $info = chrisvf_get_info();
  $places_raw = file_get_contents( dirname(__FILE__)."/places.json" );
  $places = json_decode( $places_raw, true );
  $words_raw = file_get_contents( dirname(__FILE__)."/words.json" );
  $words = json_decode( $words_raw, true );
print_r($words);exit;

  $venueToPOI = [];
  for( $i=0;$i<sizeof($places);++$i) {
    if(!empty( $places[$i]["VENUES"]  ) ) {
      foreach( $places[$i]["VENUES"] as $venue ) { 
        $venueToPOI[ $venue ] = $i;
      }
    }
  }
  foreach( $info['events'] as $event ) {
      if( !array_key_exists( $event["LOCATION"], $venueToPOI ) ) {
        $warnings []= "Event ".$event["UID"]." has a venue not listed on the map ".$event["LOCATION"];
        continue;
      }
      $poi = $venueToPOI[$event["LOCATION"]];
      $time_t = strtotime($event["DTSTART"]);
      $end_t = strtotime($event["DTEND"]);
      if( $end_t < chrisvf_time() ) { continue; } # skip done events

      $date = date( "Y-m-d", $time_t );
      $dateLabel = date( "l jS", $time_t );
      $time = date( "H:i", $time_t );
      if( @$event["ALLDAY"] ) {
        $time = "ALL DAY";
      }

      $free = false;
      if( preg_match( '/Free Fringe/', $event["CATEGORIES"] ) ) { $free = true; }

      @$places[$poi]["events"][$date]['label'] = $dateLabel;
      @$places[$poi]["events"][$date]['times'][$time][]=$event;

      if( $time_t>chrisvf_time() && $time_t<chrisvf_time()+90*60 ) {
        #starts in the next 90 minutes
        $timetext = date( "ga",$time_t);
        if( date( "i", $time_t ) != "00" ) {
          $timetext = date( "g:ia", $time_t );
        } 
        $places[$poi]["soon"][]= "<div><strong>".$timetext." - ". preg_replace('/\\\'/', '&#39;', $event['SUMMARY']) ."</strong></div>";
      }
      if( $time_t<chrisvf_time() && $end_t>chrisvf_time()+10*60 && $free ) {  # free,
        #starts in the next 90 minutes
        $places[$poi]["nowFree"][]= "<div><strong>Now - ". preg_replace('/\\\'/','&#39;',$event['SUMMARY'])."</strong></div>" ;
      }
  }

  wp_enqueue_script( 'chrisvf-leaflet' );
  wp_enqueue_script( 'chrisvf-leaflet-label' );
  wp_enqueue_style( 'chrisvf-leaflet' );
  wp_enqueue_style( 'chrisvf-leaflet-label' );


  global $mapid;
  $id = "map".(++$mapid); // make sure the js uses a unique ID in case multiple maps on a page
  $h = "";
  foreach( $warnings as $warning ) {
    $h .= "<!-- WARNING: $warning -->\n";
  }
  if( @$_GET['debug'] ) {
    $h .= "<pre>".htmlspecialchars(print_r($places,true))."</pre>";
  }
  $h.= "<style>.leaflet-tooltip { font-size: 70%; opacity: 0.7; }</style>";
  $h.= "<div id='$id' style='height: 100%; width: 100%; position: fixed; top: 0; left:0; z-index: 10000000;'>";
  $js = "";
  $js.="
jQuery( document ).ready( function() {
var map;
var bounds = L.latLngBounds([]);
(function(mapid){
  map = L.map(mapid,{scrollWheelZoom: true});
  var icon;
  var marker;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ attribution: 'Map data &copy; <a href=\"http://openstreetmap.org\">OpenStreetMap</a> contributors, <a href=\"http://creativecommons.org/licenses/by-sa/2.0/\">CC-BY-SA</a>', maxZoom: 19 }).addTo(map);

    
/* eggs offline
  // eggs

  var eggs_layer = L.featureGroup();
  var eggpath = '/wp-content/plugins/chrisvf/eggs/';

  var time_t = new Date().getTime();
  jQuery.getJSON( '/wp-content/plugins/chrisvf/eggs.json?'+time_t, function( data ) {
    jQuery.each( data, function( key, val ) {
      if( val[1] != '' ) {
        var ll = val[1].split( /,/ );
console.log( val[0], ll );
        var popup = L.popup();
        popup.setContent( '<div style=\"max-height: 300px; overflow:auto\">Well done, you have found a '+val[0]+'!<br /><br /><div style=\"font-size: 70%;\">'+val[2]+'</div></div>' );
        var marker = L.marker(ll, {
             icon: L.icon( { iconUrl: eggpath+val[0]+'.png', iconSize: [60,60], iconAnchor: [30,30], labelAnchor: [30, 30], popupAnchor: [ 0,-30 ] } )
           });
        marker.bindPopup(popup);
        eggs_layer.addLayer( marker );
      }
    });
  }); 

  map.on('zoomend', function() {
    var zoomlevel = map.getZoom();
    if (zoomlevel  <16){
        if (map.hasLayer(eggs_layer)) {
            map.removeLayer(eggs_layer);
        }
    }
    if (zoomlevel >= 16){
        if (!map.hasLayer(eggs_layer)){
            map.addLayer(eggs_layer);
        }
    }
  });
*/



 }('$id'));

";

 

#  var imageUrl = 'https://vfringe.co.uk/wp-content/uploads/sites/2/2017/08/mapfish.png';
#  var imageBounds = [[ 50.59295,-1.20932 ] ,[ 50.59242,-1.20795 ] ];
#  L.imageOverlay(imageUrl, imageBounds).addTo(map);
  foreach( $places as $place ) {
    $lat_long = join( ",",$place["GEO"]);
    if( empty($lat_long) ) { continue; }

    $icon_size = '32,37';
    $icon_anchor = '16,37';
    if( !empty($place['ICON'] )) { 
      $icon_url = $place["ICON"]; 
      # make icons link to the plugin icons directory unless they start with https:// or /
      if( !preg_match( '/^https?:/', $icon_url ) && !preg_match( '/^\//', $icon_url ) ) {
        $icon_url = plugins_url('icons/'.$icon_url, __FILE__ );
      }
    }
    if( !empty($place['ICON_SIZE'] )) { $icon_size = $place["ICON_SIZE"]; }
    if( !empty($place['ICON_ANCHOR'] )) { $icon_anchor = $place["ICON_ANCHOR"]; }

    $popup = "<p style='color: #000;font-size:130%'>".htmlspecialchars($place["NAME"])."</p>";
    if( !empty( $place["DESC"] ) ) {
      $popup.= "<p style='color: #000;'>".htmlspecialchars($place["DESC"])."</p>";
    }
    if( @$_GET['debug'] ) {
      $popup.= "<pre>".htmlspecialchars(print_r($place,true))."</pre>";
    }

    if( @$place["events"] ) {
      ksort( $place["events"] );
      foreach( $place["events"] as $day ) {
        $popup .= "<h3 style='color: #000;font-size:120%; margin-bottom:3px; margin-top: 0.5em;'>".$day["label"]."</h3>";
        ksort( $day['times'] );
        foreach( $day['times'] as $time=>$events ) {
          foreach( $events as $event ) {
            $free = false;
            if( preg_match( '/Free Fringe/i', $event["CATEGORIES"] ) ) { $free = true; }

            $url= $event["URL"];
            $name= $event["SUMMARY"];
            $popup .= "<div style='color:#000;'>$time - ";
            if( !empty($url) ) { $popup .= "<a href='$url'>".$name."</a>"; }
            else { $popup .= $name;
            if( $free ) { $popup .= " - Free Fringe"; }
          }
        }
      }
    }
  }
  $nowText = "";
  if( @$place["nowFree"] ) {
    $nowText .= join( "", $place["nowFree"] );
  }
  if( @$place["soon"] ) {
    $nowText .= join( "", $place["soon"] );
  }
  if( $nowText != "" ) {
    $nowText = "'$nowText'";
  } else {
    $nowText = 'false';
  }
  $ldir = "left";
  if( @$place["LDIR"] == "right" ) { $ldir = "right"; }
  $js.="
  (function(lat_long,icon_url,icon_size,icon_anchor, name, popupText,nowText){
    icon = L.icon( { iconUrl: icon_url, iconSize: icon_size, iconAnchor: icon_anchor, labelAnchor: [16, -18], popupAnchor: [ 0,-40 ] } );
    var label = \"<strong>\"+name+\"</strong>\";
    var markerOpts = { icon:icon };
    markerOpts.riseOnHover = true;
    var popup = L.popup();
    popup.setContent( '<div style=\"max-height: 300px; overflow:auto\">'+popupText+'</div>' );
    var marker = L.marker(lat_long, markerOpts ).bindPopup(popup).addTo(map);
    if( nowText ) {
      marker.bindTooltip(nowText, { offset: [ -16, -20], permanent: true, direction: '$ldir' } );
    }

    bounds.extend( lat_long );
}([$lat_long],'$icon_url',[$icon_size],[$icon_anchor],'".htmlspecialchars($place["NAME"], ENT_QUOTES)."','".preg_replace("/'/","\\'",$popup)."',$nowText));\n";
  }

  $js.= "map.fitBounds( bounds );\n";
  $js.= "});";

  $h.= "<script>\n";
  $h.= $js;
  $h.= "</script>\n";

  return $h;
}

