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
- block: collection
  id: posts
  content:
    title: 最新文章
    subtitle: ''
    text: ''
    count: 3
    filters:
      folders:
      - post
      author: ''
      category: ''
      tag: ''
      exclude_featured: false
      exclude_future: false
      exclude_past: false
      publication_type: ''
    offset: 0
    order: desc
  design:
    view: compact
    columns: '2'
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
- block: people
  id: team
  content:
    title: 团队成员
    text: ''
    user_groups:
    - 研究生
    - 本科生
    - 已毕业学生
    sort_by: Params.order
    sort_ascending: true
  design:
    show_interests: true
    show_role: true
    show_social: true
- block: collection
  id: projects
  content:
    title: 研究兴趣
    count: 4
    sort_by: Weight
    order: asc
    filters:
      folders:
      - project
  design:
    columns: '1'
    view: card
- block: collection
  id: courses
  content:
    title: 课程教学
    subtitle: 基础物理与量子科学课程
    count: 2
    filters:
      folders:
      - course
    order: asc
  design:
    columns: '2'
    view: compact
- block: markdown
  id: gallery
  content:
    title: 相册
    text: '{{< gallery album="group-life" >}}'
  design:
    columns: '1'
- block: contact
  id: contact
  content:
    title: 联系方式
    subtitle:
    text: '欢迎就学术问题、学生指导或科研合作通过邮件联系。'
    email: zimin.li@csu.edu.cn
    address:
      street: 中南大学
      city: 长沙
      region: 湖南，中国
      postcode: '410000'
      country: 中国
      country_code: CN
    directions: 中南大学潇湘校区物理学院437室
    coordinates:
      latitude: '28.1471'
      longitude: '112.9459'
    contact_links:
    autolink: true
    form:
      provider: ''
      formspree:
        id:
      netlify:
        captcha: false
  design:
    columns: '2'
---
