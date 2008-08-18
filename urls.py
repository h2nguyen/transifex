from django.conf.urls.defaults import *
from django.conf import settings
#Newforms admin
from django.contrib import admin


urlpatterns = patterns('',
    url(r'^$', 'django.views.generic.simple.direct_to_template',
        {'template': 'index.html'}, name='home'),
    (r'^projects/', include('txc.projects.urls')),
    #(r'^manage/', include('txc.management.urls')),
    url(r'^search/$', 'txc.views.search', name='search'),
    (r'^admin/(.*)', admin.site.root),
    url(r'^contact/', include('contact_form.urls'), name='contact'),
    url(r'^$', 'django.views.generic.simple.direct_to_template',
        {'template': 'index.html'}, name='login'),
)

if settings.STATIC_SERVE:
    urlpatterns += patterns('',
        (r'^site_media/(?P<path>.*)$', 'django.views.static.serve',
         {'document_root': settings.MEDIA_ROOT}),
    )
