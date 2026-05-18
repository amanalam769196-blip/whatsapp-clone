self.addEventListener('push', function(e) {
  var data = e.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon.png'
  });
});
