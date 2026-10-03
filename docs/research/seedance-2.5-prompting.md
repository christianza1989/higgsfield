# Seedance 2.5 promptai ir reklamos kūrimas

Patikrinta 2026-10-04. Dokumentas skirtas mūsų UGC ir produktų reklamos programai: kaip parinkti generavimo režimą, perduoti nuorodas, naudoti įgarsinimą ir aprašyti scenas. Tyrimas apima oficialius BytePlus, OpenRouter ir Higgsfield šaltinius bei esamos programos kodą.

Seedance 2.5 gali priimti produkto, aplinkos, judesio ir garso nuorodas. Mūsų OpenRouter integracija šiuo metu pateikia tik pirmą ir paskutinį kadrą. Turint galutinį įgarsinimą, rekomenduoju vaizdus montuoti pagal originalų garso takelį. Kalbančiam personažui galima bandyti garso nuorodą, bet reikia atskirai vertinti balsą ir lūpų sinchronizaciją.

Šaltiniai buvo perskaityti; viešas OpenRouter modelių katalogas patikrintas GET užklausa. BytePlus puslapių turinys perskaitytas iš jų viešo HTML dokumento duomenų, nes paieškos įrankis kai kur rodė tik puslapio antraštę. Mokamos generacijos šiam tyrimui nepaleistos. Toliau pateikti originalūs promptų šablonai yra rekomendacijos, o jų rezultatai dar neišbandyti.

## Modelio ir tiekėjų galimybės

| Sritis | Patikrinti duomenys | Šaltinis |
| --- | --- | --- |
| OpenRouter modelis | `bytedance/seedance-2.5`; katalogo versija `bytedance/seedance-2.5-20260807` | [Viešas katalogas](https://openrouter.ai/api/v1/videos/models) |
| OpenRouter trukmė ir raiška | 4–30 s, sveikomis sekundėmis; 480p ir 720p | [Viešas katalogas](https://openrouter.ai/api/v1/videos/models) |
| OpenRouter proporcijos | 16:9, 4:3, 1:1, 3:4, 9:16, 21:9 | [Viešas katalogas](https://openrouter.ai/api/v1/videos/models) |
| OpenRouter nuorodos | API numato `image_url`, `video_url`, `audio_url` įvestis per `input_references` | [Užklausos schema](https://openrouter.ai/docs/api/api-reference/video-generation/submit-a-video-generation-request) |
| Pirmas ir paskutinis kadras | OpenRouter katalogas numato abu per `frame_images` | [Viešas katalogas](https://openrouter.ai/api/v1/videos/models) |
| Higgsfield nuorodos | `/bytedance/seedance-2.5/reference-to-video`: `image_urls`, `video_urls`, `audio_urls` | [Higgsfield API](https://open.higgsfield.ai/models/bytedance/seedance-2.5/reference-to-video/api-reference) |
| BytePlus tiesioginė API | Tutorial numato ir 1080p; tai nėra mūsų OpenRouter katalogo galimybė | [BytePlus tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5) |

Katalogo kopija: [seedance-2.5-openrouter-capabilities.json](seedance-2.5-openrouter-capabilities.json). Bendro API parametro buvimas nėra praktinio veikimo mūsų paskyroje įrodymas.

## Kaip parinkti nuorodos paskirtį

OpenRouter atskiria `frame_images` ir `input_references`. Pirmoji įvestis nustato pradžios arba pabaigos kadrą, antroji pateikia turinio ar stiliaus pavyzdžius. Jei siunčiamos abi, pagal dokumentaciją pirmenybę gauna `frame_images`. [OpenRouter generavimo vadovas](https://openrouter.ai/docs/guides/overview/multimodal/video-generation).

Mano rekomenduojamas pasirinkimas reklamai:

| Turima medžiaga | Kaip ją naudoti |
| --- | --- |
| Produkto nuotrauka baltame fone | Turinio nuoroda produkto formai, spalvai ir pakuotei. Nenaudoti automatiškai kaip pirmo kadro, jei reklama neturi prasidėti baltame fone. |
| Paruoštas reklamos pradžios kadras | Pirmas kadras; jame jau turi būti norima kompozicija. |
| Paruoštas pabaigos kadras | Paskutinis kadras, jei reikia konkretaus finalo. |
| Gražus reklamos video | Judesio, kameros, ritmo arba stiliaus nuoroda. Aprašyti, kurią savybę perimti. |
| Galutinis įgarsinimas | Originalus garso takelis montažui; pasirinktinai ir modelio garso nuoroda bandymui. |
| Balso pavyzdys | Balso tembro nuoroda naujai kalbai generuoti. |
| Keli scenų paveikslėliai | Atskiri keyframes, kai reikia vaizdų sekos. |

Kiekvieną failą žymėčiau pagal jo tipą ir eilę: `@Image 1`, `@Image 2`, `@Video 1`, `@Audio 1`. Skaičiai turi atitikti to paties tipo failų eilę užklausoje; failo vardas ar užrašas pačiame paveikslėlyje šio susiejimo nepakeičia. [BytePlus portretų vadovas](https://docs.byteplus.com/en/docs/modelark/seedance-portrait-asset-guide).

Originalus produkto reklamos susiejimo pavyzdys:

```text
REFERENCE ROLES
@Image 1 defines the travel mug's shape, beige finish and black lid.
Use its product details only; create the kitchen described below.
@Image 2 defines the kitchen layout and morning lighting.
@Video 1 defines the slow camera push-in only.
Create a new advertisement; the actor and actions follow this prompt.
```

Taip sumažiname dviprasmybę: viena nuoroda neturi netyčia nurodyti ir produkto, ir veido, ir aplinkos, ir judesio. Tai mano siūloma praktika mūsų reklamos šablonams.

## Failų reikalavimai

BytePlus dokumentuoja iki 30 nuotraukų, 10 video ir 10 garso failų. Video bendra trukmė iki 30 s; vienas video 2–30 s, redagavimui 4–30 s, iki 200 MB, MP4/MOV, 24–60 fps. Garso failai WAV/MP3, 2–30 s, iki 15 MB kiekvienas, bendra trukmė iki 30 s. Nuotraukos mažesnės nei 30 MB, kraštinės 300–6000 px, proporcija 0,4–2,5. Šių modelio ribų negalima laikyti visų tarpininkų patikrintomis ribomis. [BytePlus tutorial reikalavimai](https://docs.byteplus.com/en/docs/modelark/seedance-2-5#2.5_multimodal_input).

Nuorodos turi rodyti patį failą, kurį tiekėjas gali parsisiųsti. Puslapis su X postu, prisijungimo reikalaujanti nuoroda ar vietinis `C:\...` kelias nėra toks failas. Laikinų URL galiojimą parinkčiau taip, kad apimtų visą užduoties vykdymą. [OpenRouter nuorodų praktika](https://openrouter.ai/docs/cookbook/video-generation/reference-to-video).

Mano rekomendacija: pradėti nuo 1–3 aiškių produkto nuotraukų ir vienos aplinkos nuorodos. Pridėti daugiau failų tik tada, kai jie išsprendžia konkrečią problemą. Įgarsinimą paruošti be muzikos, jei norime tiksliai įvertinti kalbos sinchronizavimą; originalą laikyti atskirai galutiniam montažui.

## Promptų struktūra ir sekundės

Oficialus vadovas rekomenduoja aiškų nuorodų susiejimą, trumpą scenos apibūdinimą, kadrų arba laiko seką ir bendrus tęstinumo reikalavimus. Seedance 2.5 palaiko sveikų sekundžių laiko žymas; intervalai turi būti nuoseklūs. Per daug įvykių trumpame intervale gali lemti praleistus veiksmus. Atskiros keyframe nuotraukos geriau nurodo konkrečius vaizdus nei viename paveikslėlyje sudėtas storyboard. Vadovas taip pat aptaria nepageidaujamus subtitrus, muziką ir garso artefaktus. [Oficialus promptų vadovas](https://docs.byteplus.com/en/docs/modelark/seedance-2-5-prompt-guide).

Mūsų šablonams siūlau tokią tvarką:

1. Užduotis: sukurti naują reklamą, animuoti kadrą, redaguoti arba pratęsti video.
2. Failų paskirtys: ką turi suteikti kiekvienas reference.
3. Pagrindinė scena: žmogus ar produktas, veiksmas, vieta, reklamos stilius.
4. Laiko planas: kiekvieno kadro vaizdas, kamera ir veiksmas.
5. Garsas: originalus įrašas, nauja kalba arba tyla.
6. Tęstinumas: produkto detalės, personažo apranga, aplinka ir apšvietimas.

Vienas kadras turėtų turėti vieną aiškų pagrindinį veiksmą. Pavyzdžiui, „paima puodelį“ arba „uždaro dangtelį“. Trijų sekundžių kadre nereikalaučiau atidaryti pakuotės, išimti produkto, jį panaudoti ir parodyti reakcijos.

Laiko žymas laikau modelio valdymo priemone, bet galutinį reklamos laiką tikrinčiau montaže. Jeigu perėjimas privalo sutapti su konkrečiu žodžiu arba 2,7 s žyma, sceną apkirpčiau ten; jos prompte neskelbčiau garantuotu rezultatu.

Rekomenduojama prompto apimtis API vadove yra iki 1000 angliškų žodžių; tai rekomendacija, o ne pageidaujamas minimumas. 15 s reklamai pradėčiau nuo maždaug 150–300 žodžių ir ilgį didinčiau tik dėl reikalingų detalių. [BytePlus užklausos parametrai](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api).

## Įgarsinimo scenarijai

| Tikslas | Mano rekomenduojamas procesas | Ką vertinti |
| --- | --- | --- |
| Išlaikyti jau įrašytą balsą tiksliai | Generuoti vaizdus su išjungtu garsu ir sumontuoti su originaliu įrašu | Scenų laikas, produkto detalės, vaizdo tęstinumas |
| Kalbantis personažas pagal įrašą | Garso nuoroda, transkriptas ir kalbėjimo intervalai; praktiškai bandyti sinchronizaciją | Žodžiai, pauzės, balsas, lūpos ir papildomi garsai |
| Naujas tekstas panašiu balsu | Balso pavyzdys ir aiškus naujas tekstas | Tembras, tarimas ir emocija |
| Video pagal muziką | Muzikos nuoroda ir scenų planas; finalo ritmą tikrinti montaže | Perėjimai ir veiksmai pagal ritmą |

BytePlus 2.5 API palaiko ir vien garso įvestį. `generate_audio=true` generuoja garsą, o `false` duoda tylų video. Generuojamas garsas yra mono. Šie faktai neįrodo, kad pateiktas įrašas bus nukopijuotas nepakeistas. [BytePlus garso parametrai](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api).

Neradau dokumentuotos garantijos, kad garso nuorodos bangos forma, tarimas ir pauzės visada bus išlaikyti tiksliai. Todėl originalų įgarsinimą visada palikčiau kaip galutinį garso šaltinį. Kalbančio personažo atveju jo uždėjimas ant sugeneruoto video savaime neišsprendžia netinkančių lūpų judesių.

Tutorial pateikia garso žymėjimą: `(music)`, `<sound effect>`, `{dialogue}` ir `【subtitles】`. Tai prompto rašymo rekomendacija, o ne atskiri API laukai. Kalbai reikia nurodyti jos pavadinimą. Oficialiai išvardijamos kinų, anglų, ispanų, indoneziečių, malajų, tajų, arabų, portugalų, vietnamiečių, japonų ir korėjiečių kalbos. Lietuvių tarp jų nėra; tai palieka jos kokybę nepatvirtintą. [BytePlus tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5).

Ankstesnės 2.0 versijos vadove balso nuorodų neatitikimai aptariami atskirai: siūloma aprašyti balso savybes ir derinti kalbėjimo stilių su pavyzdžiu. Tai papildoma bandymo idėja, o ne 2.5 kokybės garantija. [Oficialus 2.0 vadovas](https://docs.byteplus.com/en/docs/modelark/seedance-2-0-prompt-guide).

## Tikrų žmonių veidų nuorodos

Tiesioginis BytePlus ModelArk riboja paprastai įkeliamus reference su tikrais žmonių veidais. Dokumentuoti keliai: iš anksto paruošti skaitmeniniai personažai, autorizuoti realaus žmogaus asset ir patikimi toje pačioje ModelArk paskyroje sukurti originalūs modelio rezultatai. Pastarųjų galiojimas ir kilmės tikrinimas turi ribas; kitur sukurtas ar perredaguotas failas automatiškai netampa patikimu. [Portretų vadovas](https://docs.byteplus.com/en/docs/modelark/seedance-portrait-asset-guide).

Mūsų programoje nėra ModelArk personažų bibliotekos ar autorizuoto žmogaus asset proceso. OpenRouter ir Higgsfield tarpininkų veidų nuorodų priėmimą reikia tikrinti atskirai. Vien produkto nuotraukų sėkmė nepatvirtins žmogaus veido nuorodos veikimo. UGC pradžiai siūlau produktų demonstracijas rankomis arba personažą, kurio priėmimas konkrečiu tiekėju jau patikrintas.

## Generavimo režimai ir parametrų skirtumai

Tiesioginės BytePlus API režimai turi atskiras taisykles:

| Režimas | Parametrų esmė |
| --- | --- |
| Naujas video pagal references | `omni_reference_task_type="reference"`; norima trukmė ir proporcijos |
| Pirmas arba pirmas ir paskutinis kadras | `content.role="first_frame"` / `"last_frame"`; `ratio="adaptive"` |
| Esamo video redagavimas | `omni_reference_task_type="edit"`; video nuoroda, `ratio="adaptive"`, `duration=-1` |
| Pratęsimas | `omni_reference_task_type="extend"`; video nuoroda, `ratio="adaptive"` |

Prompto ketinimas turi atitikti režimą; vien priimta užklausa dar gali vėliau baigtis parametrų klaida. [BytePlus API](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api).

Šių laukų negalima tiesiog kopijuoti į OpenRouter. Jo viešas Seedance katalogas leidžia tik `watermark`, `req_key`, `output_format` papildomus tiekėjo parametrus. `omni_reference_task_type`, `draft` ir `ratio=adaptive` per mūsų integraciją nėra patvirtinti. OpenRouter API turi `previous_job_id`, bet ne visi modeliai jį palaiko; mūsų programa jo dar nenaudoja. [Katalogas](https://openrouter.ai/api/v1/videos/models), [OpenRouter užklausa](https://openrouter.ai/docs/api/api-reference/video-generation/submit-a-video-generation-request).

BytePlus Draft procesas turi atskirą 480p peržiūrą ir finalą; tutorial šiuo metu nurodo 1080p finalą ir atskirą abiejų žingsnių apmokestinimą. Mūsų paprastas 480p bandymas per OpenRouter nėra toks Draft procesas. [BytePlus Draft](https://docs.byteplus.com/en/docs/modelark/seedance-2-5#2.5_draft_mode).

## Originalūs reklamos promptų šablonai

Šablonai parašyti šiam projektui. Juose nurodyti failai turi būti iš tikrųjų perduoti atitinkamu režimu. Jie nėra išbandytų rezultatų pažadas.

### Produktų reklama su jau paruoštu įgarsinimu

Siūlomi nustatymai: 15 s, 720p, 9:16, `generate_audio=false`. Produkto nuotrauka perduodama kaip turinio nuoroda. Originalus įgarsinimas uždedamas montaže. Dabartinis mūsų OpenRouter UI šio reference režimo dar nepateikia.

```text
TASK
Create a new 15-second vertical product advertisement.

REFERENCES
@Image 1 defines the beige travel mug, its proportions and black lid.
Use the product details only. Place it in the kitchen described below.

SCENE AND STYLE
A morning coffee routine in a bright home kitchen.
Natural smartphone footage, soft window light and gentle handheld motion.
Show hands and the product; keep the mug's design consistent.

[0s-5s]
Medium close-up. A hand reaches for the mug on the kitchen counter.
The camera slowly moves closer. End with the mug clearly visible.

[5s-10s]
Cut to a close-up. Pour coffee into the mug and close the black lid.
Keep the camera steady so the action and product details are clear.

[10s-13s]
Cut to a wider shot. A hand lifts the closed mug beside a packed bag.
Use a short lateral camera movement to follow the mug.

[13s-15s]
Hold a steady product close-up beside the bag.
Leave open space above the mug for the CTA added during editing.

AUDIO AND CONTINUITY
Silent output. The finished voiceover will be added in post-production.
No generated subtitles or overlay text.
Keep the same mug, lid, counter and lighting across shots.
```

### Kalbantis UGC personažas pagal garso įrašą

Siūlomi nustatymai: 15 s, 720p, 9:16, `generate_audio=true`. Reikia personažo asset, kurį konkretus tiekėjas priima, produkto nuotraukos ir garso įrašo. Pavyzdžio tekstą ir laikus pakeisti tikru transkriptu. Lietuvių kalba čia yra bandymo tikslas.

```text
TASK
Create a new 15-second vertical UGC advertisement.

REFERENCES
@Image 1 defines the accepted creator character and grey sweater.
@Image 2 defines the beige travel mug and black lid.
@Audio 1 is the finished Lithuanian speaking track.
Use its words, voice, pronunciation, pauses and speaking rhythm
as the target for the creator's delivery.

SCENE
The creator stands in a bright home kitchen and presents the mug.
Natural phone footage, eye-level framing and small everyday gestures.

[0s-5s]
Medium shot. The creator looks at the camera and lifts the mug.
Lithuanian dialogue: {"[Exact words spoken from 0 to 5 seconds]"}
Match visible mouth movements to the corresponding part of @Audio 1.

[5s-10s]
Cut to hands closing the mug's lid on the counter.
The same voice continues off-screen:
{"[Exact words spoken from 5 to 10 seconds]"}

[10s-15s]
Cut back to the creator holding the mug, then hold the final pose.
Lithuanian dialogue: {"[Exact words spoken from 10 to 15 seconds]"}
Match mouth movements to this part of @Audio 1.

AUDIO AND CONTINUITY
One speaker. Keep the full spoken wording and intended pauses.
No extra speech, background music or generated subtitles.
Keep the character, sweater, kitchen and mug consistent.
```

Priėmimo kriterijus: įraše turi likti visi žodžiai, teisingos pauzės ir kalba; matoma kalba turi derėti su garsu. Nepavykus šių kriterijų pasiekti, kalbančias scenas keisčiau produkto kadrais arba naudočiau atskirai patikrintą lūpų sinchronizavimo procesą.

### Reklama pagal atskirus keyframes

Siūlomi failai: trys atskiri 9:16 scenų paveikslėliai su tuo pačiu produktu. Tai reference režimas, kuriame paveikslėlių paskirtis aprašoma prompte.

```text
Use @Image 1, @Image 2 and @Image 3 in that order as keyframes
for a new 15-second vertical travel-mug advertisement.

[0s-5s]
Begin with the kitchen composition in @Image 1.
A hand approaches the mug. Use a gentle camera push-in.

[5s-10s]
Cut to the product demonstration composition in @Image 2.
A hand closes the lid. Show the same mug at a believable scale.

[10s-15s]
Cut to the final product composition in @Image 3.
Use a small camera movement, then settle into a steady final hold.

Keep the mug's beige finish and black lid consistent.
Silent output; add the original voiceover and CTA during editing.
No generated overlay text or subtitles.
```

Keyframes mažina vaizdo interpretavimo laisvę, bet reklamos sekundžių sutapimą su įgarsinimu vis tiek vertinčiau iš realaus rezultato.

## Kaip perduoti duomenis API

Šios užklausos skirtos būsimai integracijai peržiūrėti. Čia nėra API rakto, jos nebuvo siunčiamos generuoti. URL yra vieta tikriems, tiekėjui prieinamiems failams.

OpenRouter reference užklausos pavyzdys pagal viešą schemą:

```json
{
  "model": "bytedance/seedance-2.5",
  "prompt": "Create a new advertisement. @Image 1 defines the product. @Audio 1 defines the spoken delivery. [Insert the complete scene plan and transcript.]",
  "duration": 15,
  "resolution": "720p",
  "aspect_ratio": "9:16",
  "generate_audio": true,
  "input_references": [
    {
      "type": "image_url",
      "image_url": { "url": "https://your-domain.example/product.png" }
    },
    {
      "type": "audio_url",
      "audio_url": { "url": "https://your-domain.example/voiceover.wav" }
    }
  ]
}
```

Video nuoroda turi analogišką `type="video_url"`, `video_url.url` struktūrą. Pirmam kadrui vietoje `input_references` naudojamas `frame_images` masyvas su `type="image_url"`, `image_url.url`, `frame_type="first_frame"`; pabaigai `last_frame`. [OpenRouter užklausos schema](https://openrouter.ai/docs/api/api-reference/video-generation/submit-a-video-generation-request), [Pirmo kadro vadovas](https://openrouter.ai/docs/cookbook/video-generation/image-to-video).

Tiesioginė BytePlus reference užklausa turi kitą struktūrą:

```json
{
  "model": "dreamina-seedance-2-5-260628",
  "omni_reference_task_type": "reference",
  "content": [
    { "type": "text", "text": "[Complete prompt with reference roles and scene plan]" },
    {
      "type": "image_url",
      "image_url": { "url": "https://your-domain.example/product.png" },
      "role": "reference_image"
    },
    {
      "type": "audio_url",
      "audio_url": { "url": "https://your-domain.example/voiceover.wav" },
      "role": "reference_audio"
    }
  ],
  "ratio": "9:16",
  "duration": 15,
  "resolution": "720p",
  "generate_audio": true
}
```

Tai alternatyvios tiesioginės integracijos pavyzdys, ne mūsų OpenRouter kūno formatas. [BytePlus API schema](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api).

Higgsfield reference endpoint vietoje šių struktūrų pateikia `image_urls`, `audio_urls`, `video_urls` masyvus ir savo `aspect_ratio` parametrą. Jo viešame apraše neradau `omni_reference_task_type`, todėl BytePlus režimo valdymo negalima automatiškai priskirti Higgsfield. [Higgsfield reference API](https://open.higgsfield.ai/models/bytedance/seedance-2.5/reference-to-video/api-reference).

## Kas jau yra mūsų programoje

Tai kodo audito išvados, o ne modelio kokybės bandymas:

| Sritis | Esama būsena |
| --- | --- |
| OpenRouter tekstas ir parametrai | Yra 4–30 s, 480p/720p, proporcijos, garso jungiklis ir seed. |
| OpenRouter nuotraukos | Iki dviejų, pirmam ir paskutiniam kadrui. |
| OpenRouter mišrios nuorodos | `input_references` pasirinkimo ir perdavimo iš UI nėra. |
| Higgsfield garsas | Yra atskiras `Seedance 2.5 Audio Reference`, vienas WAV, vietiniame registre iki 16 s. |
| Higgsfield mišrios nuorodos | Composer parenka vieną priedo tipą; produkto nuotraukos kartu su WAV šiuo režimu nepateikia. |
| Failų įkėlimas | Naudojama Higgsfield saugykla; MP4 ir WAV, garso MP3 ir video MOV upload UI nepalaiko. |
| Įvesties ribų tikrinimas | Upload bendra riba 200 MB; nėra visų modelio specifinių garso trukmės ir 15 MB ribos patikrų. |
| Tiksli reklamos laiko juosta | Nėra scenų redaktoriaus, originalaus įgarsinimo sujungimo ir galutinio montažo. |
| Garso numatytoji reikšmė | Esamuose Seedance pasirinkimuose išjungtas; įgarsinimo generavimui reikia įjungti. |

Tikrinau `lib/openrouter.ts`, `lib/openrouter-models.ts`, `lib/models.ts`, `lib/payload.ts`, `components/PromptBar.tsx`, `app/api/upload/route.ts`. Pavyzdžiui, vien į promptą įrašius `@Audio 1`, failas modelio nepasieks, jei integracija jo neperduoda.

Ankstesnį bendrą teiginį, kad garso įkėlimo dar nėra, reikia patikslinti: jis yra atskiram Higgsfield garso režimui. Trūksta OpenRouter mišrių references ir reklamos montažo proceso.

## Ką siūlau integruoti

Tai pasiūlymas pagal tyrimą; šiame darbe programos veikimas nekeistas.

1. Aiškiai atskirti „Produkto ir stiliaus nuorodos“ nuo „Pirmas ir paskutinis kadras“.
2. Pridėti mišrius OpenRouter `input_references`: nuotraukas, video ir garsą su matoma jų paskirtimi.
3. Turėti atskirus garso pasirinkimus: originalus įgarsinimas montažui, garso reference modelio generavimui ir modelio kuriamas naujas garsas.
4. Įgarsinimui pridėti transkriptą, kalbą ir scenų laikus; iš jų surinkti promptą.
5. Pridėti produkto kadro ir kalbančio personažo režimus su skirtingais tikrinimo kriterijais.
6. Tikrinti kiekvieno priedo formatą, dydį, trukmę ir nuorodos prieinamumą.
7. Įvertinti tiekėjo veidų asset procesą prieš žadant konkretaus žmogaus UGC.
8. Galutiniam video sujungti originalų garso takelį, kadrus, subtitrus ir CTA; leisti pergeneruoti vieną sceną.

Kainos skaičiavimo nereikėtų aklai taikyti naujam video reference režimui. BytePlus pavyzdžiuose kaina su video priklauso ir nuo įvesties trukmės; mažesnis tarifas už tokeną savaime nereiškia mažesnės visos užklausos kainos. Dabartinis mūsų skaičiuotuvas vertina išvesties vaizdą. [Oficiali kainodara](https://docs.byteplus.com/en/docs/modelark/model-pricing).

## Praktinio patikrinimo planas

Dokumentai nustato galimybes ir formatą. Tikslumą mūsų paskyroje reikės išmatuoti realiais, mokamais bandymais. Šiam tyrimui jie nebuvo vykdyti.

| Bandymas | Ką jis patvirtintų |
| --- | --- |
| Produkto nuotrauka per `input_references` | Ar perduodamas ir išlaikomas būtent produktas, ar nuotrauka netampa netyčiniu pirmu kadru |
| Produktas ir lietuviškas 15 s įgarsinimas | Ar priimamas mišrus formatas, ar kalba suprantama, ar nepraleidžiami žodžiai |
| Priimamas personažas, produktas ir garsas | Ar teisinga personažo tapatybė ir matomos kalbos sinchronizacija |
| Trys keyframes ir sekundžių planas | Kiek tiksliai laikomasi kadrų eilės ir perėjimų laiko |
| Tylūs kadrai su originaliu garso takeliu | Ar turime patikimą kelią išsaugoti tavo įrašą ir galutinę 15 s trukmę |

Vertinčiau produkto formą bei pakuotę, veiksmų įvykdymą, perėjimų laikus, transkripto sutapimą, lūpas, pašalinius subtitrus ir garsus. Prie kiekvieno bandymo išsaugočiau modelį, tiekėją, visą promptą, parametrus, nuorodų eilę, rezultatą ir faktinę kainą.

## Dokumentacijos neatitikimai ir atviri klausimai

- Nauja OpenRouter užklausos dokumentacija numato garso ir video references Seedance 2 ir naujesniems; senasis paieškoje randamas `create-videos` puslapis mini tik 2.0. Remtis naujuoju `submit-a-video-generation-request` puslapiu ir praktiniu bandymu. [Dabartinė schema](https://openrouter.ai/docs/api/api-reference/video-generation/submit-a-video-generation-request).
- BytePlus promptų vadove redaguoto video trukmės paklaida minima apie 0,3 s, tutorial ir API apraše apie 0,4 s. Tikslios trukmės reklamai reikia tikrinti realų failą ir montuoti. [Vadovas](https://docs.byteplus.com/en/docs/modelark/seedance-2-5-prompt-guide), [API](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api).
- Paskutinio kadro neatitinkančios proporcijos skirtinguose BytePlus aprašuose siejamos su tempimu arba apkirpimu. Abiem kadrams ruoščiau vienodas proporcijas; netinkamo formato elgesio nežadėčiau. [Vadovas](https://docs.byteplus.com/en/docs/modelark/seedance-2-5-prompt-guide), [API](https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api).
- BytePlus 1080p galimybės nepakeičia OpenRouter šiuo metu nurodytos 720p ribos. [Tutorial](https://docs.byteplus.com/en/docs/modelark/seedance-2-5), [Katalogas](https://openrouter.ai/api/v1/videos/models).
- Nerasta lietuviškos kalbos kokybės ar originalaus WAV išlaikymo garantija; jų negalima pažadėti vien promptu.

## Bendruomenės promptų bazės vertinimas

EvoLinkAI README nurodo 163 kuruotus atvejus, bet kartu sako, kad naudojami pernaudojami Seedance 2.0 promptai; greito starto užklausoje taip pat yra 2.0 modelis. Todėl repozitorijos 2.5 pavadinimas neįrodo, kad kiekvienas video buvo sugeneruotas 2.5 ar su tuo pačiu API. Tai naudinga kūrybinių idėjų bazė, kurios pavyzdžiams reikia modelio versijos ir bandymo būsenos. [Pirminis README](https://github.com/EvoLinkAI/awesome-seedance-2.5-prompts/blob/main/README.md).

Mūsų promptų bazėje siūlau saugoti paskirtį, nuorodų tipus ir vaidmenis, garso režimą, scenų planą, modelio versiją ir žymą „išbandytas“ arba „šablonas“. Taip reklamos idėja nesusimaišys su pažadu, kad konkretus promptas veikia mūsų integracijoje.

## Įgyvendinimas po tyrimo — 2026-10-04

Programoje pridėtas `/ads` reklamos planuoklis: produkto aprašas, references su
vaidmenimis, vientisas scenų laikas, originalus įgarsinimas arba modelio garsas,
scenų kainos patikra ir atskiras generavimas. Studijoje mišrūs references atskirti
nuo pirmo / paskutinio kadro režimo; serveris perduoda OpenRouter
`input_references` arba Higgsfield nuorodų masyvus ir saugo vietinę metainformaciją
atskirai nuo tiekėjo užklausos. Video reference kainai nerodomas klaidinantis vien
išvesties kainos įvertis. Aktyvus išlaidų limitas blokuoja užklausas be kainos.

Vietinis FFmpeg eksportas sujungia klipus pagal scenų trukmę, uždeda originalų
garso takelį, titrus bei CTA ir patikrina galutinio MP4 trukmę. MP3 ir MOV
normalizuojami į WAV ir MP4. Vietinis originalaus įgarsinimo kelias patikrintas
su sintetiniu 15 s montažu; jis nepateikia lūpų sinchronizacijos su įrašu.
Naujo mokamo modelio bandymo neatlikta: references išlaikymas, modelio įgarsinimo
kokybė ir personažo tęstinumas lieka tikrintini realiose generacijose. Ankstesnė
programos būklės analizė šiame dokumente aprašo būklę prieš šį įgyvendinimą.
