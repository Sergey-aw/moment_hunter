-- Replace generic placeholder YouTube URL with category-relevant links.

update public.matches
set stream_url = case
  when category = 'football' then 'https://www.youtube.com/embed/aq8vxvFl7Mc'
  when category = 'basketball' then 'https://www.youtube.com/embed/1B76b_qa8m8'
  when category = 'hockey' then 'https://www.youtube.com/embed/pFnkCRPXBkY'
  when category = 'mma' then 'https://www.youtube.com/embed/e_8JVNBr-ko'
  when category = 'esports-dota2' then 'https://www.youtube.com/embed/PTVjyCUJ_Dg'
  when category = 'esports-lol' then 'https://www.youtube.com/embed/_MNAbcb1G7M'
  when category = 'esports-valorant' then 'https://www.youtube.com/embed/hQyGZB5nS9A'
  when category = 'esports-cs2' then 'https://www.youtube.com/embed/l9monkN_cEM'
  when category = 'motorsport-f1' then 'https://www.youtube.com/embed/bFXLP487kXo'
  when category = 'tennis' then 'https://www.youtube.com/embed/hSjxZYVdptw'
  when category = 'volleyball' then 'https://www.youtube.com/embed/I-r8MxcityM'
  when category = 'handball' then 'https://www.youtube.com/embed/SkmBDb_Wpy4'
  else stream_url
end
where stream_url in (
  'https://www.youtube.com/watch?v=o3V-GvvzjE4',
  'https://www.youtube.com/embed/o3V-GvvzjE4',
  'https://www.youtube.com/@premierleague/videos',
  'https://www.youtube.com/@NBA/videos',
  'https://www.youtube.com/@NHL/videos',
  'https://www.youtube.com/@ufc/videos',
  'https://www.youtube.com/@dota2/videos',
  'https://www.youtube.com/@lolesports/videos',
  'https://www.youtube.com/@Formula1/videos',
  'https://www.youtube.com/@TennisTV/videos',
  'https://www.youtube.com/@volleyballworld/videos',
  'https://www.youtube.com/@IHFCompetitions/videos',
  'https://www.youtube.com/embed/e_E9W2vsRbQ',
  'https://www.youtube.com/embed/ExZtISgOxEQ'
);
