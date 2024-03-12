//根据id，找出被删除项
export const filterDel = (arr:any, id:string) => {
  arr.map((item:any, index:number) => {
      if(item._id == id) {
          arr.splice(index, 1)
      }
      if(item.children) {
          filterDel(item.children, id)
      }
  })
  return arr
}

//生成uuid
export const getUid = (len = 6) => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const uuid = []
  for (let i = 0; i < len; i++)
    uuid[i] = chars[0 | Math.floor(Math.random() * chars.length)]
  return uuid.join('')
}