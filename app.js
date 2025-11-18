async function fetchUser() {
  try {
    const res = await fetch('/.auth/me');
    if (!res.ok) return;

    const data = await res.json();
    const user = data?.clientPrincipal;
    if (!user) return;

    const name = user.userDetails || user.userId;
    const info = document.getElementById('user-info');
    if (info) {
      info.textContent = `Signed in as ${name}`;
    }
  } catch (err) {
    console.error('Error reading auth info', err);
  }
}

fetchUser();
