
BASE_DIR=`cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd`
cd $BASE_DIR
#curl -s -L 'https://docs.google.com/spreadsheets/d/15eV0ppEoWoo1ugf75_KL8jhRlTmKqNjPwLAADoYTL0U/export?format=tsv&id=15eV0ppEoWoo1ugf75_KL8jhRlTmKqNjPwLAADoYTL0U&gid=0' > extras.tsv 
curl -s -L 'https://docs.google.com/spreadsheets/d/1MSXhSZi4OPLs_hKfxs3oIsquVdlTWCE8NorNtGp1Kng/export?format=tsv&id=1MSXhSZi4OPLs_hKfxs3oIsquVdlTWCE8NorNtGp1Kng&gid=0' > extras.tsv 
git commit extras.tsv -m 'update extras'
