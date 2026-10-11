async function main() {
  await Promise.all(['https://www.tenethealth.com/'].map(async url=> {
    try {
      const text=await(await fetch(url,{signal:AbortSignal.timeout(10000)})).text();
      console.log(url, text.match(/(?:src|background|url|href)[=: ("']+[^\s"'<>]+(?:png|jpg|svg|gif|ico)/gi)?.filter(x=>/logo|index_01|icon|header/i.test(x)).slice(0,30));
      if(url.includes('infoman')) console.log(text.slice(0,7000));
    } catch (e) {console.log(url,e.message);}
  }));
}
main();
