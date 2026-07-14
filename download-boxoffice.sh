
BASE_DIR=`cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd`
cd $BASE_DIR
node download-boxoffice/download.js

FILES=(boxoffice-events.tsv)
if [ -f boxoffice-changes.log ]; then
  FILES+=(boxoffice-changes.log)
fi

git add "${FILES[@]}"
git commit -m 'update boxoffice events' -- "${FILES[@]}"
