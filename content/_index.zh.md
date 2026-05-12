---
title: ''
date: 2022-10-24
type: landing

sections:
  - block: about.biography
    id: about
    content:
      title: 个人简介
      username: admin
  - block: people
    id: team
    content:
      title: 团队成员
      text: ''
      user_groups:
        - 课题组负责人
        - 研究生
        - 本科生
        - 合作者
      sort_by: Params.last_name
      sort_ascending: true
    design:
      show_interests: true
      show_role: true
      show_social: true
  - block: collection
    id: featured
    content:
      title: 代表性论文
      filters:
        folders:
          - publication
        featured_only: true
    design:
      columns: '2'
      view: card
  - block: collection
    content:
      title: 近期论文
      filters:
        folders:
          - publication
        exclude_featured: false
    design:
      columns: '2'
      view: citation
  - block: skills
    content:
      title: 技能
      text: ''
      username: admin
    design:
      columns: '1'
  - block: contact
    id: contact
    content:
      title: 联系方式
      subtitle:
      text: |-
        欢迎联系
      email: zimin.li@csu.edu.cn
      address:
        street: 中南大学
        city: 长沙
        region: 湖南，中国
        postcode: '410000'
        country: 中国
        country_code: CN
      directions: 物理楼 437
      coordinates:
        latitude: '28.1471'
        longitude: '112.9459'
      contact_links:
      autolink: false
      form:
        provider: netlify
        formspree:
          id:
        netlify:
          captcha: false
    design:
      columns: '2'
---
