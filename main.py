import folium
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
import webbrowser
import os
import time
import re
import ssl
import urllib3

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def parse_postcodes(postcode_str):
    """解析输入的邮编字符串，返回邮编列表"""
    postcodes = []
    # 分割字符串
    parts = postcode_str.replace('、', ',').replace('，', ',').split(',')
    
    for part in parts:
        part = part.strip()
        if '至' in part:  # 处理范围
            start, end = part.split('至')
            start = int(start.strip())
            end = int(end.strip())
            postcodes.extend(range(start, end + 1))
        else:  # 单个邮编
            try:
                postcodes.append(int(part))
            except ValueError:
                continue
    
    return postcodes

def create_map_with_postcodes(postcode_str, max_retries=3):
    # 初始化地理编码器，设置超时时间为10秒
    geolocator = Nominatim(
        user_agent="my_agent",
        timeout=10,
        scheme='https'
    )
    
    # 解析邮编
    postcodes = parse_postcodes(postcode_str)
    print(f"共找到 {len(postcodes)} 个邮编")
    
    # 创建地图，初始位置设在澳大利亚中心
    m = folium.Map(location=[-25.2744, 133.7751], zoom_start=5)
    
    # 用于存储所有成功找到的位置
    found_locations = []
    
    for postcode in postcodes:
        search_query = f"邮政编码:{postcode}, Australia"
        
        for attempt in range(max_retries):
            try:
                location = geolocator.geocode(search_query)
                
                if location:
                    found_locations.append({
                        'postcode': postcode,
                        'location': location
                    })
                    print(f"已找到邮编 {postcode} 的位置")
                    break
                    
            except GeocoderTimedOut:
                if attempt < max_retries - 1:
                    print(f"邮编 {postcode} 请求超时，正在进行第 {attempt + 2} 次尝试...")
                    time.sleep(1)
                else:
                    print(f"邮编 {postcode} 多次尝试后仍然无法连接到服务器")
            except Exception as e:
                print(f"邮编 {postcode} 发生错误: {str(e)}")
                break
    
    if found_locations:
        # 添加所有标记
        for loc in found_locations:
            folium.Marker(
                [loc['location'].latitude, loc['location'].longitude],
                popup=f"邮编: {loc['postcode']}<br>地址: {loc['location'].address}",
                tooltip=f"邮编: {loc['postcode']}"
            ).add_to(m)
        
        # 保存地图为HTML文件
        map_file = "map.html"
        m.save(map_file)
        
        # 在浏览器中打开地图
        webbrowser.open('file://' + os.path.realpath(map_file))
        print(f"\n成功在地图上标注了 {len(found_locations)} 个位置")
    else:
        print("没有找到任何有效的位置")

def main():
    print("欢迎使用邮编地图标注工具")
    print("支持批量处理澳大利亚邮编")
    print("示例输入: 2356、2386、2387、2396、2405、2406、2672、2675、2825、2826、2829、2832至2836、2838至2840、2873、2878、2879、2898、2899")
    print("-" * 50)
    
    while True:
        postcode_str = input("\n请输入邮编（多个邮编用顿号、分隔，范围用至表示，输入 'q' 退出）: ")
        if postcode_str.lower() == 'q':
            break
        create_map_with_postcodes(postcode_str)

if __name__ == "__main__":
    main()
