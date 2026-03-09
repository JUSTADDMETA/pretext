# Corpora

Starter long-form stress corpora for browser-layout experiments.

These files are not wired into the public benchmark pages yet. They are checked
in so we have stable canaries when probing languages and punctuation systems
 beyond the current 7680-case browser sweep.

Current bundle:

- `ko-unsu-joh-eun-nal.txt`
  - Language: Korean
  - Source: Hyun Jin-geon, `운수 좋은 날`
  - URL: <https://ko.wikisource.org/wiki/%EC%9A%B4%EC%88%98_%EC%A2%8B%EC%9D%80_%EB%82%A0>
  - Acquisition: Wikisource `extracts` API, lightly cleaned

- `ar-risalat-al-ghufran-part-1.txt`
  - Language: Arabic
  - Source: Al-Ma'arri, `رسالة الغفران/الجزء الأول`
  - URL: <https://ar.wikisource.org/wiki/%D8%B1%D8%B3%D8%A7%D9%84%D8%A9_%D8%A7%D9%84%D8%BA%D9%81%D8%B1%D8%A7%D9%86/%D8%A7%D9%84%D8%AC%D8%B2%D8%A1_%D8%A7%D9%84%D8%A3%D9%88%D9%84>
  - Acquisition: Wikisource `extracts` API

- `hi-eidgah.txt`
  - Language: Hindi
  - Source: Premchand, `प्रेमचंद की सर्वश्रेष्ठ कहानियां/ईदगाह`
  - URL: <https://hi.wikisource.org/wiki/%E0%A4%AA%E0%A5%8D%E0%A4%B0%E0%A5%87%E0%A4%AE%E0%A4%9A%E0%A4%82%E0%A4%A6_%E0%A4%95%E0%A5%80_%E0%A4%B8%E0%A4%B0%E0%A5%8D%E0%A4%B5%E0%A4%B6%E0%A5%8D%E0%A4%B0%E0%A5%87%E0%A4%B7%E0%A5%8D%E0%A4%A0_%E0%A4%95%E0%A4%B9%E0%A4%BE%E0%A4%A8%E0%A4%BF%E0%A4%AF%E0%A4%BE%E0%A4%82/%E0%A4%88%E0%A4%A6%E0%A4%97%E0%A4%BE%E0%A4%B9>
  - Acquisition: Wikisource `parse` API with simple HTML-to-text cleanup

Machine-readable metadata lives in `sources.json`.

Useful commands:

- `bun run corpus-check --id=ko-unsu-joh-eun-nal 300 600 800`
- `bun run corpus-sweep --id=hi-eidgah --start=300 --end=900 --step=10`
- `bun run corpus-sweep --all --start=300 --end=900 --step=10`

The corpus page is also available locally at `/corpus?id=<corpus-id>`.
