document.addEventListener('DOMContentLoaded', () => {
  const sourceYoutube = document.getElementById('sourceYoutube');
  const sourceSpotify = document.getElementById('sourceSpotify');
  const sourceSoundcloud = document.getElementById('sourceSoundcloud');
  const sourceOther = document.getElementById('sourceOther');
  const miniPlayerAllPages = document.getElementById('miniPlayerAllPages');
  const saveBtn = document.getElementById('saveBtn');
  const statusMsg = document.getElementById('statusMsg');

  const defaultSettings = {
    sources: {
      youtube: true,
      spotify: false,
      soundcloud: false,
      other: false
    },
    miniPlayerAllPages: true
  };

  function loadSettings() {
    chrome.storage.local.get(['musicControlSettings'], (result) => {
      const settings = result.musicControlSettings || defaultSettings;

      sourceYoutube.checked = settings.sources?.youtube ?? true;
      sourceSpotify.checked = settings.sources?.spotify ?? false;
      sourceSoundcloud.checked = settings.sources?.soundcloud ?? false;
      sourceOther.checked = settings.sources?.other ?? false;
      miniPlayerAllPages.checked = settings.miniPlayerAllPages ?? true;
    });
  }

  function saveSettings() {
    const settings = {
      sources: {
        youtube: sourceYoutube.checked,
        spotify: sourceSpotify.checked,
        soundcloud: sourceSoundcloud.checked,
        other: sourceOther.checked
      },
      miniPlayerAllPages: miniPlayerAllPages.checked
    };

    chrome.storage.local.set({ musicControlSettings: settings }, () => {
      statusMsg.textContent = '✓ Settings saved!';
      statusMsg.classList.add('show');
      setTimeout(() => {
        statusMsg.classList.remove('show');
      }, 2000);
    });
  }

  saveBtn.addEventListener('click', saveSettings);
  loadSettings();
});
