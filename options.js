document.addEventListener('DOMContentLoaded', async () => {
  const ids = ['sourceYoutube', 'sourceSpotify', 'sourceSoundcloud', 'sourceOther', 'miniPlayerAllPages', 'youtubeAllImportEnabled'];
  const controls = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const status = document.getElementById('statusMsg');
  const response = await chrome.runtime.sendMessage({ action: MusicControlContracts.Actions.GET_PUBLIC_STATE });
  const settings = response.data.settings;
  controls.sourceYoutube.checked = settings.sources.youtube; controls.sourceSpotify.checked = settings.sources.spotify; controls.sourceSoundcloud.checked = settings.sources.soundcloud; controls.sourceOther.checked = settings.sources.other; controls.miniPlayerAllPages.checked = settings.miniPlayerAllPages; controls.youtubeAllImportEnabled.checked = settings.youtubeAllImportEnabled === true;
  const syncExperimental = () => { controls.youtubeAllImportEnabled.disabled = !controls.sourceYoutube.checked; };
  controls.sourceYoutube.addEventListener('change', syncExperimental); syncExperimental();
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const next = { sources: { youtube: controls.sourceYoutube.checked, spotify: controls.sourceSpotify.checked, soundcloud: controls.sourceSoundcloud.checked, other: controls.sourceOther.checked }, miniPlayerAllPages: controls.miniPlayerAllPages.checked, youtubeAllImportEnabled: controls.sourceYoutube.checked && controls.youtubeAllImportEnabled.checked };
    const result = await chrome.runtime.sendMessage({ action: MusicControlContracts.Actions.UPDATE_PUBLIC_SETTINGS, settings: next });
    status.textContent = result.ok ? 'Settings saved.' : result.error.message; status.classList.add('show'); setTimeout(() => status.classList.remove('show'), 2000);
  });
  MusicControlOptionsApiKey.init();
});
