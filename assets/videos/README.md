# Videos

## welcome.mp4

The loop behind the welcome screen (`src/app/welcome.tsx`): 15.4 seconds,
540 × 960, H.264, no sound, about 2.7 MB. Its first frame is
`assets/images/welcome-poster.jpg`, shown while it loads and with Reduce
Motion.

Cut from free Pexels clips (the [Pexels licence](https://www.pexels.com/license/)
allows use in an app without credit; listed here so we can find them again):

| Order | Clip                                             | Pexels video                                                                                                  |
| ----- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 1     | A couple at the fire with their family           | [10805308](https://www.pexels.com/video/people-during-indian-wedding-10805308/)                               |
| 2     | Mehndi being applied, marigolds behind           | [15455199](https://www.pexels.com/video/close-up-view-of-a-bride-having-mehndi-applied-on-her-hand-15455199/) |
| 3     | Two women in suits carrying flower trays         | [8855201](https://www.pexels.com/video/women-holding-trays-of-flowers-8855201/)                               |
| 4     | A bride's and groom's hands joined (centre crop) | [33499308](https://www.pexels.com/video/elegant-outdoor-indian-wedding-ceremony-33499308/)                    |
| 5     | A henna-night dance                              | [7249112](https://www.pexels.com/video/muslim-woman-doing-traditional-dance-7249112/)                         |
| 6     | A bride in red                                   | [29575339](https://www.pexels.com/video/elegant-bride-in-traditional-red-bridal-attire-29575339/)             |
| 7     | A bride in Dubai                                 | [38812861](https://www.pexels.com/video/elegant-bride-in-dubai-s-downtown-38812861/)                          |

Each clip is 2.8 seconds with 0.6-second crossfades, and the end fades back
into the first clip so the loop has no seam. To swap a clip, rebuild with
ffmpeg the same way (scale and crop to 540 × 960, 30 fps, `xfade` between
clips, `-crf 27 -movflags +faststart`, no audio) and keep the file under
about 3 MB, since it ships inside the app. Once there is real footage from
our founding vendors (with their permission), it should replace the stock.
