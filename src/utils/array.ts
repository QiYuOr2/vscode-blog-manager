export function tryPush<T>(array: T[], item: T) {
  let tempArray = array?.slice?.() ?? [];
  tempArray ? tempArray.push(item) : (tempArray = [item]);
  return tempArray;
}
