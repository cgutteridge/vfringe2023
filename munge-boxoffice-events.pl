#!/usr/bin/perl

use strict;
use warnings;

use JSON;
use DateTime::Format::ISO8601;
use Data::Dumper;

my $in_filename = "events.json";
my $out_filename = "boxoffice-events.tsv";

my $json_text = do {
   open(my $json_fh, "<:encoding(UTF-8)", $in_filename)
      or die("Can't open \"$in_filename\": $!\n");
   local $/;
   <$json_fh>
};

my $json = JSON->new;
my $data = $json->decode($json_text);

open( my $tsv_fh, ">:encoding(UTF-8)", $out_filename ) or die "Can't open $out_filename: $!";
print {$tsv_fh} "Venue	Date	Start	End	Title	Event	Tags	Description\n";
foreach my $record ( @{$data} ) {

    # Add in the events which were sold out when I downloaded the JSON from the boxoffice
   
    my $id;
    if( $record->{id} =~ m/^(\d+)/ ) {
        $id = $1;
    }
    
    # Drunk Women Solving Crime
    if( $id eq "1001" ) { 
        push @{$record->{availableInstanceDates}}, "2025-07-19T19:30:00";
    }
    # Ahir Shah
    if( $id eq "8002" ) { 
        push @{$record->{availableInstanceDates}}, "2025-07-25T17:00:00";
    }
    # Gong
    if( $id eq "7201" ) { 
        push @{$record->{availableInstanceDates}}, "2025-07-25T09:00:00";
    }
    # Arcade
    if( $id eq "1201" ) { 
        # this seems to have changed lets leave it alone
        #push @{$record->{availableInstanceDates}}, "2025-07-20T15:15:00";
        #push @{$record->{availableInstanceDates}}, "2025-07-22T15:14:30
        #push @{$record->{availableInstanceDates}}, "2025-07-22T15:15:15";
        #push @{$record->{availableInstanceDates}}, "2025-07-22T15:15:15";
    }

    # Compute end dates
    my @events = map {
        # parse the start time
        my $dt = DateTime::Format::ISO8601->parse_datetime($_);
        # add the duration (in minutes)
        $dt->add( minutes => $record->{duration} );
        # format back to ISO-8601-ish string
        [ $_, $dt->strftime('%Y-%m-%dT%H:%M:%S'), $record->{duration} ];
    } @{ $record->{availableInstanceDates} };

    foreach my $event ( @events ) {
        my @row = qw/ venue date start end title event tags description /;
        #if( $record->{htmlDescription} =~ m/Venue:<\/span> ([^<]+)/ ) {
        if( $record->{htmlDescription} =~ m/(Venue:<\/span>( |<[^>]*>)*([^<]*))/ ) {
            $row[0] = $3;
            $row[0] =~ s/^ *//;
            $row[0] =~ s/ *$//;
        }
        $row[1] = substr( $event->[0], 0, 10 ); 
        $row[2] = substr( $event->[0], 11, 5 ); 
        $row[3] = substr( $event->[1], 11, 5 ); 
        $row[4] = $record->{name};
        if( defined $id ) {
            $row[5] = "https://purchase.vfringe.co.uk/EventAvailability?EventId=$id";

            if( $id eq "30601" ) { # artists breakfast
                $row[0] = "Ingrams Yard";
            }
            if( $id eq "30201" || $id eq "30801" ) { # artists breakfast
                $row[0] = "The Fringe Village Box Office";
            }
            if( $id eq "7201" ) { # Gongs
                $row[0] = "The Bijou @ Fringe Village, Ventnor Park";
            }
            if( $id eq "6201" ) { # Enfant Terrible
                $row[0] = "Rotunda @ Fringe Village, Flowersbrook";
            }
        }

        # no mapping required:
        # "The Fringe Village Box Office":
        # "Ventnor Botanic Garden":
        # "Ingrams Yard":

        my %map = (
            "Bosco Theatre \@ Fringe Village, Ventnor Park" => "Bosco Theatre",
            "The Bosco \@ Fringe Village, Ventnor Park" => "Bosco Theatre",
            "Ingrams Yard, Dudley Road" => "Ingrams Yard",
            "Peer Studios, Pier Street" => "Peer Studios",
            "Pier Street Playhouse, Pier Street" => "Pier Street Playhouse",
            "Rotunda \@ Fringe Village, Flowersbrook" => "Rotunda",
            "St Catherine's Church, Church Street" => "St. Catherine's Church",
            "Start the walk at the Family Fringe entrance, Ventnor Park" => "Family Fringe entrance of Ventnor Park",
            "The Bijou \@ Fringe Village, Ventnor Park" => "Bijou",
            "The Container \@ Ingrams Yard, Dudley Road" => "The Container",
            "Ventnor Arts Club, High Street" => "Ventnor Arts Club",
            "Ventnor Exchange Arena \@ Flowersbrook" => "Ventnor Exchange Arena",
            "Ventnor Exchange, 11 Church Street" => "Ventnor Exchange",
            "Ventnor Exchange, 11 Church Street, PO38 1SW" => "Ventnor Exchange",
            "Ventnor Library, High Street" => "Ventnor Library",
            "Ventnor Park (Putting Green end) \@ Fringe Village, Ventnor Park" => "Ventnor Park (Putting Green end)",
        );

        $row[0] = $map{ $row[0] } if exists $map{ $row[0] };

        $row[6] = $record->{attribute_EventType};
        $row[7] = $record->{description};
        foreach my $cell ( @row ) { 
            $cell =~  s/[\r\t\n]/ /g;
        }
        print {$tsv_fh} join( "\t", @row )."\n";
    }
}
close $tsv_fh;



exit;

__DATA__
Venue	Date	Start	End	Title	Event	Tags	Description


  {
    "description": "Want to learn more about coffee? Join Ben from Craft House Coffee for a fun and informal coffee tasting that's open to all.\r\n\r\nIn a technique called cupping, you will taste several different coffees, thinking about their smell, texture and taste.  This will help you to learn about the differences between origins, processes and roasts that make up their taste, and more importantly learn what kinds of coffee you like! If you particularly like any of the beans on offer, you will be able to take some home at the end of the session.\r\n\r\nCraft House Coffee are Ventnor Exchange's coffee supplier, based in Sussex. They are focused on knowing exactly where their beans come from and who produces them. They prioritise smallholdings, form long-term relationships, and repeat-purchase harvests to support their producers.",
    "htmlDescription": "<div id>\r\n\t<span class=\"BoldText\">Want to learn more about coffee? Join Ben from Craft House Coffee (Ventnor Exchange's coffee providers) for a fun and informal coffee tasting that's open to all.</span><span><br/></span><span><br/></span>In a technique called cupping, you will taste several different coffees, thinking about their smell, texture and taste.  This will help you to learn about the differences between origins, processes and roasts that make up their taste, and more importantly learn what kinds of coffee you like! If you particularly like any of the beans on offer, you will be able to take some home at the end of the session.<span><br/></span><span><br/></span>Craft House Coffee are Ventnor Exchange's coffee supplier, based in Sussex. They are focused on knowing exactly where their beans come from and who produces them. They prioritise smallholdings, form long-term relationships, and repeat-purchase harvests to support their producers.<span><br/></span><span><br/></span><span class=\"BoldText\">Venue:</span> Ventnor Exchange, 11 Church Street<span><br/></span><span><br/></span><span class=\"BoldText\">Tickets:</span> General Admission £12<span><br/></span><span><br/></span><span class=\"BoldText\">Duration:</span> 1 Hour<span><br/></span><span><br/></span><span class=\"BoldText\">Accessibility:</span> For more information on accessibility and to book tickets, please contact the box office at hello@ventnorexchange.co.uk, 01983 716767\r\n</div>",
    "duration": 60,
    "name": "Coffee Tasting with Craft House Coffee",
    "instanceDates": "4 July-17 September",
    "firstInstanceDateTime": "2025-07-04T12:00:00",
    "lastInstanceDateTime": "2025-09-17T12:00:00",
    "attribute_EventType": "Workshop",
    "attribute_WebsiteListing": "Main Programme",
    "attribute_AccessInformation": "",
    "availableInstanceDatesUtc": [
      "2025-09-17T11:00:00"
    ],
    "availableInstanceDates": [
      "2025-09-17T12:00:00"
    ],
    "isSoldOut": false,
    "lastAvailableInstanceId": "45401AJDKTHQLVSLBBVQGBPQSVNVKLQMM"
  },
