# Amazon Prime

Unfortunately, it's very annoying to attempt to automate grabbing new entries from Amazon Prime Video.

- their state is spread among headers, cookies and url parameters, all encoded, hard to parse.

- The API seems to resist giving answers to non-browser clients, copying network requests as cURL won't give me an answer

- Automating the browser interactions is a pain because playwright doesn't work on all linux distros and is a big dependency

- personally, i need to prioritize an _answer_ over getting this to be a nice perfect automated system.

So within this program, it's going to be a **static** list.

## Updating Manually

- Open `src/providers/amazon.ts`
- Open your browser and go to `https://www.amazon.com/gp/video/genre/anime` - these are the Prime shows labeled "Anime".
- Click on TV Shows or Movies -> View More (for movies, you may need to click into TV Shows then change the filter to hold movies)
  Scroll until we've got all the entries, then run this in your browser console to get all the titles

```js
Array.from(document.querySelectorAll("div>ul article")).map(
  (u) => u.attributes["data-card-title"].nodeValue,
);
```

Note that not all anime have this label, i.e. Banana Fish is not in this list for no good reason :( :mad:
