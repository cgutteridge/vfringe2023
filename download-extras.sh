
BASE_DIR=`cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd`
cd $BASE_DIR
curl -s -L 'https://docs.google.com/spreadsheets/d/15eV0ppEoWoo1ugf75_KL8jhRlTmKqNjPwLAADoYTL0U/export?format=csv&id=15eV0ppEoWoo1ugf75_KL8jhRlTmKqNjPwLAADoYTL0U&gid=0' > extras.csv 
git commit extras.csv -m 'update extras'
