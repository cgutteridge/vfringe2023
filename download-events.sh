
BASE_DIR=`cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd`
cd $BASE_DIR
curl -s -L 'https://app.spektrix-link.com/clients/ventnorexchange/eventsView.json' > events.json 
git commit events.json -m 'update events'
