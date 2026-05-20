
BASE_DIR=`cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd`
cd $BASE_DIR
node download-boxoffice/download.js
git commit boxoffice-events.tsv -m 'update boxoffice events'
