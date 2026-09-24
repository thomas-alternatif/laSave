/**
 * laSave — anciens liens de partage (lasave.partage.workers.dev/<id>)
 * Plus aucune clé ici : on renvoie simplement vers la page de partage de l'API.
 */
export default {
  async fetch(request) {
    const id = new URL(request.url).pathname.replace(/^\/+/, '').trim();
    if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return Response.redirect('https://la-save.fr', 302);
    return Response.redirect(`https://lasave-api.partage.workers.dev/e/${id}`, 301);
  },
};
