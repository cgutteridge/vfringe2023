const urls = []
for (var i = 1; i < 25; i++) {
  urls.push('https://ventnorexchange.littleboxoffice.com/browse?filter%5Binclude_past_events%5D=0&filter%5Bgroup_scheduled_events%5D=0&filter%5Bhide_unavailable_events%5D=0&filter%5Bliked_events%5D=0&view_as=list&page=' + i)
}

// scrape_urls.js

const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
}

const extractedUrls = []

async function scrapePage (url) {
  try {
    const response = await axios.get(url, { headers: headers })
    const html = response.data
    const $ = cheerio.load(html)

    $('a.block').each((index, element) => {
      const href = $(element).attr('href')
      if (href) {
        const cleanUrl = href.split('?')[0]
        extractedUrls.push(cleanUrl)
        console.log('Found URL: ' + cleanUrl)
      }
    })
  } catch (error) {
    console.error('Failed to load: ' + url, error)
  }
}

const extractedJsonBlocks = []

async function scrapeJson (url) {
  try {
    const response = await axios.get(url, { headers: headers })
    const html = response.data
    const $ = cheerio.load(html)
    let extracted
    $('script[type="application/ld+json"]').each((index, element) => {
      const jsonContent = $(element).html()
      if (jsonContent) {
        try {
          extracted = JSON.parse(jsonContent)
          extracted.url = url
          console.log('Extracted JSON-LD from: ' + url)
        } catch (error) {
          console.error('Failed to parse JSON-LD from: ' + url, error)
        }
      }
    })
    if (extracted !== undefined) {
      // find vue
      const vueRaw = $('div[id="vue"]').first().attr('data-page')
      const vue = JSON.parse(vueRaw)
      const desc = vue?.props?.event?.description
      extracted.desc = desc.replace(/\t/g, ' ')
      extractedJsonBlocks.push(extracted)
    }
  } catch (error) {
    console.error('Failed to load: ' + url, error)
  }
}

async function createTsv (data) {
  const filePath = path.join(__dirname, '../boxoffice-events.tsv')
  const header = ['Venue', 'Date', 'Start', 'End', 'Title', 'Event', 'Tags', 'Description']
  const records = data.map(jsonData => {
    return [
      jsonData.location.name,
      jsonData.startDate.split('T')[0],
      jsonData.doorTime ? formatTime(jsonData.doorTime) : '',
      jsonData.endDate ? formatTime(jsonData.endDate) : '',
      jsonData.name,
      jsonData.url,
      '',
      jsonData.desc
    ].join('\t')
  })

  const tsvContent = [header.join('\t'), ...records].join('\n')

  fs.writeFile(filePath, tsvContent, 'utf8', (err) => {
    if (err) {
      console.error('Error writing TSV file:', err)
    } else {
      console.log('TSV file created successfully.')
    }
  })
}

function formatTime (dateTime) {
  const date = new Date(dateTime)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function delay (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main () {
  for (const url of urls) {
    await scrapePage(url)
    await delay(2000) // 2-second delay between requests
  }

  for (const url of extractedUrls) {
    await scrapeJson(url)
    await delay(2000) // 2-second delay between requests
  }

  await createTsv(extractedJsonBlocks)
}

main().then(() => console.log('done'))

