import { createRouter, createWebHashHistory } from 'vue-router'
import groups from './demos'

const demos = groups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.title })),
)

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    ...demos.map((demo) => ({
      path: demo.path,
      component: demo.component,
      meta: { group: demo.group, title: demo.title, desc: demo.desc, code: demo.code },
    })),
    { path: '/:pathMatch(.*)*', redirect: demos[0].path },
  ],
})
