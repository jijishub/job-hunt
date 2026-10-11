import html2canvas from 'html2canvas-pro';

async function waitBriefly(promise: Promise<unknown>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([promise.catch(() => undefined), new Promise<void>((resolve) => {
      timer = setTimeout(resolve, milliseconds);
    })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function captureReport(report: HTMLElement) {
  await waitBriefly(report.ownerDocument.fonts.ready, 1000);
  await waitBriefly(Promise.all(Array.from(report.querySelectorAll('img')).map((image) =>
    image.complete ? Promise.resolve() : image.decode())), 1500);
  return html2canvas(report, {
    scale: 2,
    useCORS: true,
    imageTimeout: 1500,
    backgroundColor: '#FAF7F9',
    logging: false,
    scrollX: 0,
    scrollY: 0,
    // Keep styles, the report, and its ancestors; omit other application UI.
    ignoreElements: (element) => report.ownerDocument.body.contains(element)
      && !report.contains(element) && !element.contains(report),
  });
}
