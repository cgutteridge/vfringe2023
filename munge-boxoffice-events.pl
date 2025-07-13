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

openmy $tsv_fh 
Dumper( \@row );
print "Venue	Date	Start	End	Title	Event	Tags	Description\n";
foreach my $record ( @{$data} ) {

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
        if( $record->{id} =~ m/^(\d+)/ ) {
            $row[5] = "https://purchase.vfringe.co.uk/EventAvailability?EventId=$1";
        }
        $row[6] = $record->{attribute_EventType};
        $row[7] = $record->{description};
        foreach my $cell ( @row ) { 
            $cell =~  s/[\t\n]/ /g;
        }
        print join( "\t", @row )."\n";
    }
}



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
