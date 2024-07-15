<?php
/**
 * @package ChrisVF
 * @version 1.0
 */
/*
Plugin Name: Chris' Ventnor Fringe Hacks
Plugin URI: http://wordpress.org/plugins/hello-dolly/
Description: VFringe Hacks by Chris.
Author: Christopher Gutteridge
Version: 1.1
Author URI: http://users.ecs.soton.ac.uk/cjg/
*/

require_once( "itinerary.php" );
require_once( "map.php" );
require_once( "grid.php" );
require_once( "ff.php" );
require_once( "roulette.php" );
require_once( "now_and_next.php" );


/* FRINGE FUNCTIONS */

function chrisvf_time() {
	return time()+@$_GET["TIMESHIFT"];
}

/*********************************************************************************
 DATA FUNCTIONS
 *********************************************************************************/

function chrisvf_get_events() {
  $info = chrisvf_get_info();
  return $info['events'];
}
function chrisvf_get_venues() {
  $info = chrisvf_get_info();
  return $info['venues'];
}

function chrisvf_get_info() {
  global $chrisvf_cache;
  #print "\n<!-- GET CACHE -->\n";
  $CACHE = false;

  if( !@$_GET['redo'] && !empty( $chrisvf_cache ) && !empty( $chrisvf_cache['events'])) {
    #print "\n<!-- ...RAM CACHE -->\n";
    return $chrisvf_cache;
  }

  $cache_file = "/tmp/vfringe-events.json";
  $cache_timeout = 60*30; # 30 minute cache

  if( $CACHE 
   && !@$_GET['redo'] 
   && file_exists($cache_file) 
   && (filemtime($cache_file) > (chrisvf_time() - $cache_timeout))) {
    #print "\n<!-- ...USE CACHE FILE -->\n";
    $chrisvf_cache = json_decode( file_get_contents( $cache_file ),true);
  } else {
    #print "\n<!-- ...BUILD CACHE FILE -->\n";
    $chrisvf_cache["events"] = chrisvf_wp_events();
    $chrisvf_cache["venues"] = chrisvf_wp_venues();

    file_put_contents($cache_file, json_encode($chrisvf_cache), LOCK_EX);
  }

  return $chrisvf_cache;
}

// return a list of venues. This does not include additional map locations like ATMs 
function chrisvf_wp_venues() {
	$tax_meta  = get_option( "evo_tax_meta" );
	$locations = get_terms( "event_location" );
    $venues = [];
	foreach( $locations as $location ) {
		$venue = [
			"name"     => $location->name,
			"slug"     => $location->slug,
			"sortcode" => $location->name
		];
		if( array_key_exists( $location->term_id, $tax_meta["event_location"] ) ) {
			$extras = $tax_meta["event_location"][$location->term_id];
			$venue["lat"] = $extras["location_lat"];
			$venue["lon"] = $extras["location_lon"];
		}
		$venues[$venue["name"]]=$venue;
	}

	return $venues;
}

function chrisvf_wp_events() {
	$meta_fields = [
		'repeat_intervals',
		'evcal_srow',
		'evcal_erow',
		'_status',
		'_evo_tz',
		'evcal_allday',
		'evcal_repeat',
		'_evcal_exlink_option'
	];
	$args 	= [ 
			'post_status'=>'publish',
			'post_type'=>'ajde_events',
			'numberposts'=>-1
		];
	$events = get_posts( $args );

	foreach( $events as $event ) {
		$event->meta = [];
		foreach( $meta_fields as $meta_field ) {
	    		$event->meta[$meta_field] = get_post_meta( $event->ID, $meta_field, true );
		}
		$event->locations  = wp_get_post_terms( $event->ID, 'event_location', [ 'fields'=>'names' ] );
		$event->categories = wp_get_post_terms( $event->ID, 'event_type',     [ 'fields'=>'names' ] );
		if( has_post_thumbnail( $event->ID ) ) {
			$event->image = get_post_thumbnail_id( $event->ID );
		}
	}

  	if( @$_GET['debug'] == "WP" ) {
		print "<pre>";
		print_r( $events );
	}

#_status                     | scheduled 
#_evo_date_format            | Y/m/d      
#_evo_time_format            | 12h         
#_start_hour                 | 5        
#_start_minute               | 00        
#_start_ampm                 | pm         
#_end_hour                   | 6           
#_end_minute                 | 00           
#_end_ampm                   | pm            
#_evo_tz                     | Europe/London  
#evcal_allday		     | no


	$ical = array();
	foreach( $events as $event_post ) {
		$times = [[ $event_post->meta["evcal_srow"],$event_post->meta["evcal_erow"] ]];
		if( $event_post->meta["evcal_repeat"] == "yes" && !empty( $event_post->meta["repeat_intervals"] )) {
			$times = $event_post->meta["repeat_intervals"];
		}
		foreach( $times as $time ) {

			if ( $event->meta["evcal_allday"] == 'yes' ) {
				$item[ "ALLDAY"] = true;
				$format = 'Ymd';
			} else {
				$format = 'Ymd\THis';
			}
		
			$item[ "DTSTART"] = date( $format, $time[0] );
			$item[ "DTEND"]   = date( $format, $time[1] );
		
			$item[ 'UID' ]         = $event_post->ID . '-' . $time[0];
			$item[ 'SUMMARY' ]     = $event_post->post_title ;
			$item[ 'DESCRIPTION' ] = $event_post->post_content ;
			$item[ 'URL' ]         = get_permalink( $event_post->ID );
	
			// add location if available
			if( !empty( $event_post->locations ) ) {
				$item[ 'LOCATION' ] = html_entity_decode( $event_post->locations[0] , ENT_QUOTES);
			}
			// add categories if available
			if ( ! empty( $event_post->categories ) ) {
				$item['CATEGORIES'] = html_entity_decode( join( ',', $event_post->categories ), ENT_QUOTES );
			}


			# hi future chris. Sorry about this bit. Previous years had a free fringe category but
			# this year (2022) has a tag. So the quick and dirty solution was to add the category 
			# back in if the tag was set
			$tags = get_the_tags( $event_post->ID );
                        $freetag = false;
			// add tags if available
			if ( ! empty( $tags ) ) {
				$slugs = [];
				foreach( $tags as $tag ) {
					$slugs []= $tag->slug;
					if( $tag->slug == "free-fringe" ) {
                                                $freetag = true;
					}
				}
				$item['TAGS'] = join( ',', $slugs );
			}
			if( $freetag ) {
				if( empty( $item['CATEGORIES'] ) ) {
					$item['CATEGORIES'] = "Free Fringe";
				} else {
					$item['CATEGORIES'] .= ",Free Fringe";
				}
			}

			if( !empty($event_post->image) ) {
				$image = wp_get_attachment_image_src( $event_post->image );
				$item["IMAGE"] = $image[0];
			}

			$item["SORTCODE"] = chrisvf_location_sortcode($item["LOCATION"]);
			$ical[$item["UID"]]= $item;
		}
	}

	# load csv events

	$csv_files = [
        file( __DIR__."/extras.csv" ),
        file( __DIR__."/boxoffice-events.csv" )
    ];
    foreach( $csv_files as $csvFile ) {
	    $heading_row = trim(array_shift($csvFile));
	    $headings = preg_split( "/,/", $heading_row );
	    foreach( $csvFile as $row ) {
		    $cells = preg_split( "/,/", $row );
		    $record = [];
		    for($i=0;$i<count($headings);++$i) {
			    $record[$headings[$i]]=trim($cells[$i]);
		    }
    
		    # skip records with ??? in to indicate unconfirmed ones
		    if( preg_match( "/\?\?\?/", $record["Title"] ) ) { continue; }
    
		    $UID = sprintf("%s:%s:%s", $record["Venue"], $record["Date"], $record["Start"] );
		    $item = [
			    "UID"=>$UID,
			    "DTSTART"=>preg_replace( "/-/","", $record["Date"] )."T".preg_replace("/:/","",$record["Start"] )."00",
			    "DTEND"=>preg_replace( "/-/","", $record["Date"] )."T".preg_replace("/:/","",$record["End"] )."00",
			    "SUMMARY"=>$record["Title"],
			    "DESCRIPTION"=>"",
			    "URL"=>$record["Event"],
			    "LOCATION"=>$record["Venue"],
			    "SORTCODE"=>chrisvf_location_sortcode($record["Venue"]),
				"CATEGORIES"=>"",
		    ];
		    $ical[ $UID ] = $item;
	    }	
    }
     return $ical;
}

function chrisvf_location_sortcode( $loc ) {
	switch( $loc ) {
		case "Ventnor Exchange": 	return "001"; 
		case "The Fringe Square": 	return "002"; 
		case "St. Catherine's Church":	return "003"; 
		case "The Book Bus": 		return "004"; 

		case "The Fringe Village": 	return "011"; 
		case "Fringe Village Bandstand": return "012"; 
		case "The Nest": 		return "013"; 
		case "The Magpie": 		return "014"; 

		case "The Big Top": 		return "021"; 
		case "The Big Top Bar": 	return "022"; 
	}
	return "100".$loc;
}

/*********************************************************************************
 end of DATA FUNCTIONS
 *********************************************************************************/

